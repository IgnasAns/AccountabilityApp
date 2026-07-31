// Expo's Metro config. Without this file Metro silently falls back to bare
// React Native's defaults, which do NOT inject EXPO_PUBLIC_* variables into the
// bundle — every one of them reads back as undefined at runtime. That is how
// v1.0.11 (vc15) shipped pointing at the placeholder Supabase URL and failed
// every network call with "Network request failed". Do not delete.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
