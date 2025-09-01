
// Import polyfills first
import '../../polyfills';

// Then import Firebase
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCcg0pjSgfFkj0Y_NmtppoUKOt3XSFteTU",
  authDomain: "accountability-app-61a67.firebaseapp.com",
  projectId: "accountability-app-61a67",
  storageBucket: "accountability-app-61a67.firebasestorage.app",
  messagingSenderId: "30944525772",
  appId: "1:30944525772:web:88e61113f838dcb7533169"
};


// Note: Replace these values with your actual Firebase configuration
// You can find them in Firebase Console > Project Settings > Your apps

// Initialize Firebase only if it hasn't been initialized
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Auth
const auth = getAuth(app);

// Initialize other services
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };