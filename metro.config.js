// Expo's Metro config. Without this file Metro silently falls back to bare
// React Native's defaults, which do NOT inject EXPO_PUBLIC_* variables into the
// bundle — every one of them reads back as undefined at runtime. That is how
// v1.0.11 (vc15) shipped pointing at the placeholder Supabase URL and failed
// every network call with "Network request failed". Do not delete.
//
// Web platform: react-native-iap (v14, Nitro-based) deep-imports
// react-native/Libraries paths that have no .web variants, which killed
// `expo export --platform web`. On web we swap in stubs/react-native-iap.web.js.
// Android keeps the real module — resolveRequest only rewrites .web requests.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && moduleName === 'react-native-iap') {
        return { filePath: require('path').resolve(__dirname, 'stubs/react-native-iap.web.js'), type: 'sourceFile' };
    }
    if (originalResolveRequest) {
        return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
