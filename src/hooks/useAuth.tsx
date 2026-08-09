import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Linking, Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase, initAuthListener, cleanupAuthListener } from '../services/supabase';
import { track } from '../services/track';
import { Profile } from '../types/database';
import { env } from '../config/env';
import { rateLimiters } from '../utils/rateLimiter';
import { cancelAllGoalReminders, unregisterPushToken } from '../services/notifications';

const PASSWORD_RESET_REDIRECT_URL = 'doitmate://reset-password';
const SESSION_LOAD_TIMEOUT_MS = 6000;
const AUTH_REQUEST_TIMEOUT_MS = 15000;

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, name: string) => Promise<void>;
    signOut: () => Promise<void>;
    signInAsGuest: () => Promise<void>;
    updateProfile: (updates: Partial<Profile>) => Promise<void>;
    refreshSession: () => Promise<void>;
    requestPasswordReset: (email: string) => Promise<void>;
    resetPassword: (newPassword: string) => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
    deleteAccount: () => Promise<void>;
    passwordRecovery: boolean;
    clearPasswordRecovery: () => void;
    isGuest: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    signIn: async () => {},
    signUp: async () => {},
    signOut: async () => {},
    signInAsGuest: async () => {},
    updateProfile: async () => {},
    refreshSession: async () => {},
    requestPasswordReset: async () => {},
    resetPassword: async () => {},
    changePassword: async () => {},
    deleteAccount: async () => {},
    passwordRecovery: false,
    clearPasswordRecovery: () => {},
    isGuest: false,
});

function parseAuthUrlParams(url: string): Record<string, string> {
    const params: Record<string, string> = {};
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');
    const chunks: string[] = [];

    if (queryIndex >= 0) {
        chunks.push(url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined));
    }
    if (hashIndex >= 0) {
        chunks.push(url.slice(hashIndex + 1));
    }

    chunks
        .join('&')
        .split('&')
        .filter(Boolean)
        .forEach((pair) => {
            const [rawKey, ...rawValue] = pair.split('=');
            if (!rawKey) return;

            try {
                const key = decodeURIComponent(rawKey);
                const value = decodeURIComponent(rawValue.join('=') || '');
                params[key] = value;
            } catch {
                params[rawKey] = rawValue.join('=') || '';
            }
        });

    return params;
}

async function getStoredSessionWithTimeout(): Promise<Session | null> {
    const sessionPromise = supabase.auth
        .getSession()
        .then(({ data }) => data.session)
        .catch((error) => {
            console.error('[Auth] Session load failed:', error);
            return null;
        });

    const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), SESSION_LOAD_TIMEOUT_MS);
    });

    return Promise.race([sessionPromise, timeoutPromise]);
}

async function withAuthTimeout<T>(promise: Promise<T>, errorMessage: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), AUTH_REQUEST_TIMEOUT_MS);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);
    const [passwordRecovery, setPasswordRecovery] = useState(false);

    const fetchProfile = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('[Auth] Error fetching profile:', error);
                return;
            }

            // Guard against a fetch resolving after SIGNED_OUT (stale identity).
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session?.user?.id !== userId) {
                return;
            }

            setProfile(data as Profile);
        } catch (err) {
            console.error('[Auth] Error fetching profile:', err);
        }
    }, []);

    const scheduleProfileFetch = useCallback((userId: string) => {
        setTimeout(() => {
            fetchProfile(userId);
        }, 0);
    }, [fetchProfile]);

    const handlePasswordRecoveryUrl = useCallback(async (url: string): Promise<boolean> => {
        const params = parseAuthUrlParams(url);
        const isRecoveryUrl = url.includes('reset-password') || params.type === 'recovery';

        if (!isRecoveryUrl) {
            return false;
        }

        try {
            setLoading(true);

            if (params.error || params.error_code) {
                throw new Error(params.error_description || params.error || 'Password reset link failed.');
            }

            let recoverySession: Session | null = null;

            if (params.code) {
                const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
                if (error) throw error;
                recoverySession = data.session;
            } else if (params.access_token && params.refresh_token) {
                const { data, error } = await supabase.auth.setSession({
                    access_token: params.access_token,
                    refresh_token: params.refresh_token,
                });
                if (error) throw error;
                recoverySession = data.session;
            }

            if (!recoverySession) {
                const { data } = await supabase.auth.getSession();
                recoverySession = data.session;
            }

            if (!recoverySession) {
                throw new Error('Password reset link expired. Please request a new reset email.');
            }

            setPasswordRecovery(true);
            setSession(recoverySession);
            setUser(recoverySession.user);
            setIsGuest(false);
            await fetchProfile(recoverySession.user.id);
            return true;
        } catch (error) {
            console.error('[Auth] Password recovery link error:', error);
            setPasswordRecovery(false);
            return false;
        } finally {
            setLoading(false);
        }
    }, [fetchProfile]);

    // Initialize auth listener
    useEffect(() => {
        initAuthListener();

        const initializeAuth = async () => {
            try {
                const initialUrl = Platform.OS === 'web' ? undefined : await Linking.getInitialURL();
                if (initialUrl) {
                    const handledRecovery = await handlePasswordRecoveryUrl(initialUrl);
                    if (handledRecovery) return;
                }

                const session = await getStoredSessionWithTimeout();
                setSession(session);
                setUser(session?.user ?? null);
                setIsGuest(session?.user?.is_anonymous === true);
                if (session?.user) {
                    await fetchProfile(session.user.id);
                }
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (env.enableDebugLogs) {
                    console.log('[Auth] State change:', event);
                }
                setSession(session);
                setUser(session?.user ?? null);
                setIsGuest(session?.user?.is_anonymous === true);

                if (event === 'PASSWORD_RECOVERY' && session?.user) {
                    setPasswordRecovery(true);
                    scheduleProfileFetch(session.user.id);
                } else if (event === 'SIGNED_IN' && session?.user) {
                    scheduleProfileFetch(session.user.id);
                } else if (event === 'SIGNED_OUT') {
                    setProfile(null);
                    setIsGuest(false);
                    setPasswordRecovery(false);
                } else if (event === 'TOKEN_REFRESHED') {
                    // Session was refreshed, no action needed
                }

                setLoading(false);
            }
        );

        const linkingSubscription = Platform.OS === 'web'
            ? undefined
            : Linking.addEventListener('url', ({ url }) => {
                handlePasswordRecoveryUrl(url);
            });

        return () => {
            subscription.unsubscribe();
            linkingSubscription?.remove();
            cleanupAuthListener();
        };
    }, [fetchProfile, handlePasswordRecoveryUrl, scheduleProfileFetch]);

    const signIn = useCallback(async (email: string, password: string) => {
        if (!rateLimiters.auth.canProceed()) {
            throw new Error('Too many attempts. Please wait a minute and try again.');
        }
        setIsGuest(false);
        const { data, error } = await withAuthTimeout(
            supabase.auth.signInWithPassword({
                email: email.toLowerCase().trim(),
                password,
            }),
            'Sign in timed out. Please check your connection and try again.'
        );

        if (error) throw error;

        if (data.user) {
            await fetchProfile(data.user.id);
        }

        track('login_completed');
    }, [fetchProfile]);

    const signUp = useCallback(async (email: string, password: string, name: string) => {
        if (!rateLimiters.auth.canProceed()) {
            throw new Error('Too many attempts. Please wait a minute and try again.');
        }
        setIsGuest(false);
        const { data, error } = await supabase.auth.signUp({
            email: email.toLowerCase().trim(),
            password,
            options: {
                data: {
                    name: name.trim(),
                },
            },
        });

        if (error) throw error;

        // Create profile record
        if (data.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: data.user.id,
                    name: name.trim(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

            if (profileError) {
                console.error('[Auth] Error creating profile:', profileError);
            }

            await fetchProfile(data.user.id);
        }

        track('signup_completed');
    }, [fetchProfile]);

    const signOut = useCallback(async () => {
        const isAnon = user?.is_anonymous;

        // Drop the push token and any pending reminders while we still have a
        // valid session — after signOut the delete would be rejected by RLS,
        // and the next account on this device would inherit the reminders.
        if (user) {
            await unregisterPushToken(user.id).catch(() => {});
            await cancelAllGoalReminders().catch(() => {});
        }

        try {
            // Track while the session is still valid — the auth row is gone
            // right after signOut and RLS would drop an anonymous insert.
            track('logout');
            const { error } = await supabase.auth.signOut();
            if (error) {
                // Fall back to local-only signout so the UI never stays
                // authenticated against a possibly-invalidated session.
                console.error('[Auth] Remote signOut failed, clearing locally:', error);
                await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
            }
        } finally {
            // Local state must always be cleared, even on network error.
            setUser(null);
            setProfile(null);
            setSession(null);
            setIsGuest(false);
        }

        // For anonymous users, also delete the account
        if (isAnon) {
            try {
                // Anonymous users are ephemeral - data cleanup is handled by RLS
                // The session is already invalidated by signOut above
            } catch {
                // Ignore cleanup errors for anonymous accounts
            }
        }
    }, [user]);

    const signInAsGuest = useCallback(async () => {
        // Use Supabase anonymous auth - creates a real auth session
        const { data, error } = await supabase.auth.signInAnonymously();

        if (error) {
            // If anonymous auth is not enabled, throw a descriptive error
            if (error.message.includes('Anonymous') || error.message.includes('anonymous')) {
                throw new Error('Anonymous sign-in is not enabled. Please enable it in your Supabase dashboard under Authentication > Providers.');
            }
            throw error;
        }

        if (data.user) {
            setIsGuest(true);
            // Profile is auto-created by the trigger
            // Give a moment for the trigger to fire, then fetch
            await new Promise(resolve => setTimeout(resolve, 500));
            await fetchProfile(data.user.id);
        }
    }, [fetchProfile]);

    const updateProfile = useCallback(async (updates: Partial<Profile>) => {
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('profiles')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

        if (error) throw error;

        // Refresh profile
        await fetchProfile(user.id);
    }, [user, fetchProfile]);

    const refreshSession = useCallback(async () => {
        const { data, error } = await withAuthTimeout(
            supabase.auth.refreshSession(),
            'Session refresh timed out. Please try again.'
        );
        if (error) {
            console.error('[Auth] Session refresh failed:', error);
            throw error;
        }
        if (data.session) {
            setSession(data.session);
            setUser(data.session.user);
        }
    }, []);

    const requestPasswordReset = useCallback(async (email: string) => {
        const { error } = await withAuthTimeout(
            supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
                redirectTo: PASSWORD_RESET_REDIRECT_URL,
            }),
            'Password reset request timed out. Please try again.'
        );

        if (error) throw error;
    }, []);

    const resetPassword = useCallback(async (newPassword: string) => {
        const session = await getStoredSessionWithTimeout();

        if (!session) {
            throw new Error('Password reset session expired. Please request a new reset email.');
        }

        const { data, error } = await withAuthTimeout(
            supabase.auth.updateUser({ password: newPassword }),
            'Password update timed out. Please check your connection and try again.'
        );
        if (error) throw error;

        setPasswordRecovery(false);
        setUser(data.user ?? session.user);
        setSession(data.user ? { ...session, user: data.user } : session);
    }, []);

    const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
        if (!user?.email) {
            throw new Error('This account does not have an email password to change.');
        }

        if (user.is_anonymous) {
            throw new Error('Guest accounts do not have passwords. Create an account before changing a password.');
        }

        const email = user.email.toLowerCase().trim();
        const { data: verificationData, error: verificationError } = await withAuthTimeout(
            supabase.auth.signInWithPassword({
                email,
                password: currentPassword,
            }),
            'Current password verification timed out. Please try again.'
        );

        if (verificationError) {
            throw new Error('Current password is incorrect.');
        }

        const verifiedSession = verificationData.session ?? session;
        if (verificationData.session) {
            setSession(verificationData.session);
            setUser(verificationData.session.user);
        }

        const { data, error } = await withAuthTimeout(
            supabase.auth.updateUser({ password: newPassword }),
            'Password update timed out. Please check your connection and try again.'
        );
        if (error) throw error;

        setUser(data.user ?? verifiedSession?.user ?? user);
        if (data.user && verifiedSession) {
            setSession({ ...verifiedSession, user: data.user });
        }
    }, [session, user]);

    /**
     * Permanently delete the signed-in account.
     *
     * Required by Google Play for any app offering account creation. The heavy
     * lifting is server-side in delete_my_account(), which has to walk the FK
     * graph by hand (several tables reference profiles without ON DELETE
     * CASCADE) and transfers ownership of any groups this user created rather
     * than destroying other members' history.
     */
    const deleteAccount = useCallback(async () => {
        if (!user) throw new Error('Not authenticated');

        // Best-effort: stored files first, while the session can still be
        // authorised against storage. A failure here must not block deletion of
        // the account itself.
        const { error: storageError } = await supabase.rpc('delete_my_storage_objects');
        if (storageError) {
            console.error('[Auth] Storage cleanup failed, continuing:', storageError.message);
        }

        // supabase.rpc() returns a thenable builder, not a real Promise, so it
        // has to be adopted before withAuthTimeout can race it.
        const { error } = await withAuthTimeout(
            Promise.resolve(supabase.rpc('delete_my_account')),
            'Account deletion timed out. Please check your connection and try again.'
        );
        if (error) throw error;

        // The auth row is gone, so the session is already void; clear locally
        // rather than round-tripping a signOut that would now fail.
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        await cancelAllGoalReminders().catch(() => {});

        setUser(null);
        setProfile(null);
        setSession(null);
        setIsGuest(false);
        setPasswordRecovery(false);
    }, [user]);

    const clearPasswordRecovery = useCallback(() => {
        setPasswordRecovery(false);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                session,
                loading,
                signIn,
                signUp,
                signOut,
                signInAsGuest,
                updateProfile,
                refreshSession,
                requestPasswordReset,
                resetPassword,
                changePassword,
                deleteAccount,
                passwordRecovery,
                clearPasswordRecovery,
                isGuest,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
