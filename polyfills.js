// Essential polyfills for Firebase with React Native
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Base64 polyfill for Firebase
import { decode, encode } from 'base-64';

if (!global.btoa) {
  global.btoa = encode;
}

if (!global.atob) {
  global.atob = decode;
}