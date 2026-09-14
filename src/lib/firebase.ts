import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAwDA6WANr0WU7NaMXE1uhDCDwmEkHX-E8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "chatwave-afc45.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "chatwave-afc45",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "chatwave-afc45.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "348081858888",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:348081858888:web:acefbfbe705c3ee2ec2b7d",
  measurementId: "G-XCPQ63243W"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
