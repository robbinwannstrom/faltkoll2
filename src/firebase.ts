import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App singleton
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with the dedicated database ID
export const db: Firestore = initializeFirestore(
  app,
  {},
  firebaseConfig.firestoreDatabaseId || undefined
);

export default db;
