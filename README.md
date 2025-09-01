# Pactify - React Native Accountability App

A React Native mobile application that allows users to create monetary pacts with friends to enforce discipline and achieve their goals.

## Features

### 🔐 User Authentication
- Email/password signup and login using Firebase Authentication
- User profile management with virtual balance tracking

### 👥 Friend System
- Add friends via email address
- Friend list management
- View friend profiles

### 📋 Pact Creation
- Create accountability pacts with friends
- Two types of pacts:
  - **Time-Based Commitment**: Requires proof of work submission
  - **Habit-Breaking**: Self-reported failure tracking
- Set custom penalty amounts in virtual currency

### 💰 Virtual Balance System
- All transactions are virtual (no real money)
- Penalty payments transfer between user balances
- Real-time balance updates

### 📱 Core Screens
- **Dashboard**: View active pacts and current balance
- **Pact Detail**: Submit proof or report failures
- **Profile**: Manage account and friends
- **Create Pact**: Set up new accountability agreements

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- React Native development environment
- Firebase project setup
- Android Studio (for Android) or Xcode (for iOS)

### Firebase Configuration

1. Create a new Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)

2. Enable the following services:
   - **Authentication**: Enable Email/Password provider
   - **Firestore Database**: Create in production mode
   - **Storage**: For image uploads

3. Create Firestore security rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Pacts can be read/written by creator or partner
    match /pacts/{pactId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.creatorUid || 
         request.auth.uid == resource.data.partnerUid);
    }
    
    // Reports can be read/written by the reporter
    match /reports/{reportId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.reporterUid;
    }
  }
}
```

4. Get your Firebase configuration and update `App.jsx`:
```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};
```

### Installation

1. Clone or download the project files
2. Install dependencies:
```bash
npm install
```

3. For iOS (additional setup):
```bash
cd ios && pod install && cd ..
```

4. Update Firebase configuration in `App.jsx`

### Running the App

#### Android
```bash
npm run android
```

#### iOS
```bash
npm run ios
```

#### Start Metro bundler
```bash
npm start
```

## Data Models

### Users Collection
```javascript
{
  uid: string,
  email: string,
  displayName: string,
  balance: number,
  friends: [
    {
      id: string,
      email: string,
      displayName: string
    }
  ]
}
```

### Pacts Collection
```javascript
{
  pactId: string,
  creatorUid: string,
  partnerUid: string,
  title: string,
  description: string,
  type: "time-based" | "habit-breaking",
  penalty: number,
  status: "active" | "completed",
  createdAt: timestamp
}
```

### Reports Collection
```javascript
{
  reportId: string,
  pactId: string,
  reporterUid: string,
  timestamp: timestamp,
  proofImageUrl?: string,
  status: "pending" | "approved" | "rejected"
}
```

## Key Features Implementation

### Image Upload for Proof
- Uses `react-native-image-picker` for photo selection
- Uploads to Firebase Storage
- Stores download URLs in Firestore

### Virtual Currency System
- All transactions are virtual and stored in Firestore
- Penalty payments automatically transfer between users
- Real-time balance updates

### Privacy-Focused Design
- No automatic screenshot capture
- Manual proof submission only
- User-controlled failure reporting

## Development Notes

- Single-file implementation in `App.jsx` for prototype simplicity
- Uses React hooks for state management
- Firebase SDK v10 for modern compatibility
- Responsive design with StyleSheet

## Troubleshooting

### Common Issues

1. **Firebase initialization errors**:
   - Verify your Firebase config values
   - Ensure all required services are enabled

2. **Image picker not working**:
   - Add camera/photo library permissions to iOS Info.plist
   - Add storage permissions for Android

3. **Build errors**:
   - Clean the project: `cd android && ./gradlew clean`
   - Reset Metro cache: `npx react-native start --reset-cache`

### Permissions Required

#### iOS (Info.plist)
```xml
<key>NSCameraUsageDescription</key>
<string>This app needs access to camera to capture proof images</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>This app needs access to photo library to select proof images</string>
```

#### Android (android/app/src/main/AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

## Future Enhancements

- Push notifications for pact reminders
- Social features and leaderboards
- Real money integration (Stripe, PayPal)
- Advanced analytics and progress tracking
- Web dashboard for comprehensive management

## Support

For issues and questions:
1. Check Firebase console for errors
2. Review React Native documentation
3. Ensure all dependencies are properly installed
4. Verify device permissions are granted

---

**Note**: This is a prototype implementation focused on core functionality. Additional security measures, error handling, and optimizations should be implemented for production use.