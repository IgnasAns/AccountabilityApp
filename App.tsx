import React, { useEffect } from 'react';
import { View, ActivityIndicator, Platform, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';

import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { NotificationProvider } from './src/hooks/useNotifications';
import { navigationRef } from './src/services/navigationRef';
import { AlertProvider } from './src/components/StyledAlert';
import ErrorBoundary from './src/components/ErrorBoundary';
import AppIcon from './src/components/AppIcon';
import { colors } from './src/theme/colors';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateGroupScreen from './src/screens/CreateGroupScreen';
import JoinGroupScreen from './src/screens/JoinGroupScreen';
import GroupDetailScreen from './src/screens/GroupDetailScreen';
import GroupChatScreen from './src/screens/GroupChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import ActivityScreen from './src/screens/ActivityScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Re-exported so consumers that historically imported these from App.tsx
// (e.g. notification tap routing) keep working — the definitions now live in
// src/services/navigationRef.ts to break the App -> useNotifications -> App
// require cycle.
export { navigationRef } from './src/services/navigationRef';
export type { RootStackParamList } from './src/services/navigationRef';

// A join deep link that arrives before the navigation tree is ready (cold
// start, or while the user is still on the auth flow) is parked here and
// flushed on the first onReady.
let pendingJoinCode: string | null = null;

function handleJoinDeepLink(url: string | null) {
    if (!url) return;
    const match = url.match(/doitmate:\/\/join\?code=([A-Za-z0-9]+)/i);
    if (!match) return;
    const code = match[1];

    if (navigationRef.isReady()) {
        // JoinGroup only exists inside the signed-in navigator. If the auth
        // flow is showing, park the code until the user signs in (the
        // NavigationContainer remounts and flushes it via onReady).
        const routeName = navigationRef.getCurrentRoute()?.name;
        if (routeName === 'Login' || routeName === 'SignUp' || routeName === 'ForgotPassword' || routeName === 'ResetPassword') {
            pendingJoinCode = code;
        } else {
            navigationRef.navigate('JoinGroup', { inviteCode: code });
        }
    } else {
        pendingJoinCode = code;
    }
}

function flushPendingDeepLink() {
    if (pendingJoinCode && navigationRef.isReady()) {
        navigationRef.navigate('JoinGroup', { inviteCode: pendingJoinCode });
        pendingJoinCode = null;
    }
}

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: Platform.OS === 'android' ? 70 + insets.bottom : 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.16,
          shadowRadius: 8,
          elevation: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <AppIcon name={focused ? 'home-variant' : 'home-variant-outline'} color={color} size={24} />
          )
        }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreScreen}
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <AppIcon name={focused ? 'compass' : 'compass-outline'} color={color} size={24} />
          )
        }}
      />
      <Tab.Screen
        name="AddTab"
        component={CreateGroupScreen}
        listeners={({ navigation: nav }) => ({
          tabPress: (e) => {
            e.preventDefault();
            nav.navigate('CreateGroup');
          },
        })}
        options={{
          title: '',
          tabBarIcon: ({ color, size }) => (
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: colors.primary,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: -15,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.28,
              shadowRadius: 8,
              elevation: 8,
            }}>
              <AppIcon name="plus" color={colors.text} size={30} />
            </View>
          )
        }}
      />
      <Tab.Screen
        name="ActivityTab"
        component={ActivityScreen}
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <AppIcon name={focused ? 'bell' : 'bell-outline'} color={color} size={24} />
          )
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <AppIcon name={focused ? 'account-circle' : 'account-circle-outline'} color={color} size={24} />
          )
        }}
      />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  const { passwordRecovery } = useAuth();

  return (
    <Stack.Navigator
      initialRouteName={passwordRecovery ? 'ResetPassword' : 'Login'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { passwordRecovery } = useAuth();

  return (
    <Stack.Navigator
      initialRouteName={passwordRecovery ? 'ResetPassword' : 'MainTabs'}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: 'Create Group', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="JoinGroup"
        component={JoinGroupScreen}
        options={{ title: 'Join Group', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetailScreen as React.ComponentType<Record<string, unknown>>}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupChat"
        component={GroupChatScreen as React.ComponentType<Record<string, unknown>>}
        options={{ title: 'Group Chat', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Change Password', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ title: 'Set New Password', headerBackTitle: 'Back' }}
      />
    </Stack.Navigator>
  );
}

function NavigationWrapper() {
  const { user, loading, passwordRecovery } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={flushPendingDeepLink}
      key={passwordRecovery ? 'password-recovery' : user ? 'app' : 'auth'}
    >
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function App() {
  // Set Android navigation bar color to match app theme
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Set the navigation bar background color to match the app
      NavigationBar.setBackgroundColorAsync(colors.background);
      // Set the button style to light (for dark backgrounds)
      NavigationBar.setButtonStyleAsync('light');
    }
  }, []);

  // Deep links: doitmate://join?code=XXXXXXXX — cold start + warm start.
  useEffect(() => {
    // Cold start: the OS hands the URL to us before JS finishes booting.
    Linking.getInitialURL()
      .then(handleJoinDeepLink)
      .catch(() => {});

    // Warm start: the app is already running.
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleJoinDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <SafeAreaProvider>
            <AlertProvider>
              <StatusBar style="light" />
              <NavigationWrapper />
            </AlertProvider>
          </SafeAreaProvider>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
