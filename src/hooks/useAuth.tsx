import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Profile } from '../types/database';

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    signUp: (email: string, password: string, name: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    updateProfile: (updates: Partial<Profile>) => Promise<void>;
    signInAsGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);

    // Safety timeout to prevent infinite loading screen
    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) {
                console.warn('Auth loading timed out, forcing app load.');
                setLoading(false);
            }
        }, 5000);
        return () => clearTimeout(timer);
    }, [loading]);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        }).catch((error) => {
            console.error('Error getting session:', error);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    await fetchProfile(session.user.id);
                } else {
                    setProfile(null);
                }
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    async function fetchProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    }

    async function signUp(email: string, password: string, name: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name }, // This metadata is used by the Postgres trigger to create the profile
            },
        });
        if (error) {
            throw error;
        }

        // If auto-confirm is enabled, data.session will be present. 
        // If email confirmation is required, data.session will be null.
        if (data.session) {
            setSession(data.session);
            setUser(data.user);
            // Profile creation is handled by a Database Trigger on the 'auth.users' table
            // referencing public.handle_new_user()
        }
    }

    async function signIn(email: string, password: string) {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
    }

    async function signOut() {
        // Handle guest mode immediately
        if (isGuest) {
            setUser(null);
            setProfile(null);
            setSession(null);
            setIsGuest(false);
            return;
        }

        // Force clear local state FIRST to ensure UI updates immediately
        setSession(null);
        setUser(null);
        setProfile(null);

        // Then attempt to sign out from Supabase (don't await or set loading)
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.warn('Supabase sign out warning (local state already cleared):', error);
            // Ignore - local state is already cleared so user is logged out from app's perspective
        }
    }

    async function signInAsGuest() {
        setIsGuest(true);
        // Create a mock user and profile for guest
        const guestUser = {
            id: 'guest_user_id',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        } as User;

        const guestProfile = {
            id: 'guest_user_id',
            name: 'Guest User',
            avatar_url: null,
            payment_link: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        setUser(guestUser);
        setProfile(guestProfile);
    }

    async function updateProfile(updates: Partial<Profile>) {
        if (!user) throw new Error('No user logged in');

        const { error } = await supabase
            .from('profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', user.id);

        if (error) throw error;
        setProfile((prev) => (prev ? { ...prev, ...updates } : null));
    }

    const value = {
        user,
        profile,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        signInAsGuest,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
