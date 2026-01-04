import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, Platform, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';

import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { AlertProvider } from './src/components/StyledAlert';
import { colors } from './src/theme/colors';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import HomeScreen from './src/screens/HomeScreen';
import CreateGroupScreen from './src/screens/CreateGroupScreen';
import JoinGroupScreen from './src/screens/JoinGroupScreen';
import GroupDetailScreen from './src/screens/GroupDetailScreen';
import GroupChatScreen from './src/screens/GroupChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
          paddingTop: 8,
          paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 8) : insets.bottom,
          height: Platform.OS === 'android' ? 64 + Math.max(insets.bottom, 8) : 60 + insets.bottom,
          // Premium shadow effect
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 20,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>🏠</Text>
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>👤</Text>
        }}
      />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  return (
    <Stack.Navigator
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
        component={GroupDetailScreen as any}
        options={{ title: 'Group Details', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="GroupChat"
        component={GroupChatScreen as any}
        options={{ title: 'Group Chat', headerBackTitle: 'Back' }}
      />
    </Stack.Navigator>
  );
}

function NavigationWrapper() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
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

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <AlertProvider>
          <StatusBar style="light" />
          <NavigationWrapper />
        </AlertProvider>
      </SafeAreaProvider>
    </AuthProvider>
  );
}