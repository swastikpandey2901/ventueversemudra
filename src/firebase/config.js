// ─── Firebase Configuration ───────────────────────────────────────────────────
// Keys are loaded from .env file (copy .env.example → .env and fill values)
// Steps to get Firebase keys:
//   1. Go to https://console.firebase.google.com/
//   2. Create a project named "mudra"
//   3. Click ⚙️ Project Settings → Add Web App
//   4. Copy config values into your .env file

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
