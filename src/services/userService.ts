import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserAccount } from '../types';

const USERS_COLLECTION = 'users';

/**
 * Normalizes email or identifier for safe and consistent lookups
 */
export function normalizeIdentifier(val: string): string {
  return String(val || '')
    .trim()
    .toLowerCase();
}

/**
 * Saves or updates a user directly in Google Cloud Firestore.
 * Ensures the account is IMMEDIATELY available across all devices worldwide.
 */
export async function saveUserToCloud(user: UserAccount): Promise<boolean> {
  try {
    const cleanUser: UserAccount = {
      ...user,
      email: normalizeIdentifier(user.email),
      displayName: String(user.displayName || '').trim(),
      password: user.password ? String(user.password).trim() : '1234',
      lastLogin: user.lastLogin || new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    // Primary document by ID
    const primaryRef = doc(db, USERS_COLLECTION, cleanUser.id);
    await setDoc(primaryRef, cleanUser, { merge: true });

    // Secondary index document by normalized email/username for instant O(1) retrieval
    if (cleanUser.email) {
      const emailSafeKey = `account_${cleanUser.email.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const emailRef = doc(db, USERS_COLLECTION, emailSafeKey);
      await setDoc(emailRef, cleanUser, { merge: true });
    }

    return true;
  } catch (err) {
    console.warn('Could not save user to cloud Firestore:', err);
    return false;
  }
}

/**
 * Finds a user directly in Google Cloud Firestore by email or username or ID.
 */
export async function findUserInCloud(identifier: string): Promise<UserAccount | null> {
  const norm = normalizeIdentifier(identifier);
  if (!norm) return null;

  try {
    // 1. Try fast email key lookup
    const emailSafeKey = `account_${norm.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const emailRef = doc(db, USERS_COLLECTION, emailSafeKey);
    const emailSnap = await getDoc(emailRef);
    if (emailSnap.exists()) {
      const data = emailSnap.data() as UserAccount;
      if (data && data.email) return data;
    }

    // 2. Try direct ID lookup
    const idRef = doc(db, USERS_COLLECTION, norm);
    const idSnap = await getDoc(idRef);
    if (idSnap.exists()) {
      const data = idSnap.data() as UserAccount;
      if (data && data.email) return data;
    }

    // 3. Query collection where email == norm
    const emailQuery = query(
      collection(db, USERS_COLLECTION),
      where('email', '==', norm),
      limit(1)
    );
    const emailResults = await getDocs(emailQuery);
    if (!emailResults.empty) {
      return emailResults.docs[0].data() as UserAccount;
    }

    // 4. Query collection where displayName == identifier
    const nameQuery = query(
      collection(db, USERS_COLLECTION),
      where('displayName', '==', identifier.trim()),
      limit(1)
    );
    const nameResults = await getDocs(nameQuery);
    if (!nameResults.empty) {
      return nameResults.docs[0].data() as UserAccount;
    }

    return null;
  } catch (err) {
    console.warn('Error querying user in Firestore:', err);
    return null;
  }
}

/**
 * Fetches all user accounts from Google Cloud Firestore.
 */
export async function fetchAllUsersFromCloud(): Promise<UserAccount[]> {
  try {
    const colRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(colRef);
    const users: UserAccount[] = [];
    const seen = new Set<string>();

    snap.forEach((docSnap) => {
      // Ignore helper index documents if they duplicate by ID
      const data = docSnap.data() as UserAccount;
      if (data && data.id && data.email && data.role) {
        if (!seen.has(data.id)) {
          seen.add(data.id);
          users.push(data);
        }
      }
    });

    return users;
  } catch (err) {
    console.warn('Could not fetch all users from Firestore:', err);
    return [];
  }
}

/**
 * Removes a user from Google Cloud Firestore.
 */
export async function deleteUserFromCloud(userId: string, email?: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, USERS_COLLECTION, userId));
    if (email) {
      const norm = normalizeIdentifier(email);
      const emailSafeKey = `account_${norm.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      await deleteDoc(doc(db, USERS_COLLECTION, emailSafeKey));
    }
    return true;
  } catch (err) {
    console.warn('Could not delete user from Firestore:', err);
    return false;
  }
}
