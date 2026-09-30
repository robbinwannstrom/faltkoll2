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
import { UserAccount, TeacherExercise } from '../types';

const USERS_COLLECTION = 'users';
const EXERCISES_COLLECTION = 'exercises';

export const STANDARD_STUDENT_GROUPS = [
  'Byggprogrammet (BA)',
  'Anläggning & Maskin',
  'Vuxenutbildning (VUX)',
  'Gymnasie Åk 1 (BA25)',
  'Gymnasie Åk 2 (BA24)',
  'Gymnasie Åk 3 (BA23)',
  'Lärlingar / APL',
  'Osorterad / Allmän',
];

/**
 * Rank-based authorization check:
 * - ADMIN: can edit ALL accounts (Admin, Teacher, Student)
 * - TEACHER: can edit accounts strictly below their rank (Student only)
 * - STUDENT: cannot edit any account details
 */
export function canEditUser(actor: UserAccount | null | undefined, target: UserAccount): boolean {
  if (!actor) return false;
  if (actor.role === 'ADMIN') return true;
  if (actor.role === 'TEACHER') {
    return target.role === 'STUDENT';
  }
  return false;
}

/**
 * Check if the actor can delete the target user
 */
export function canDeleteUser(actor: UserAccount | null | undefined, target: UserAccount): boolean {
  if (!actor) return false;
  // Nobody can delete the primary system administrator
  if (target.id === 'usr_admin_main' || target.email.toLowerCase() === 'admin@faltkoll.se') {
    return false;
  }
  if (actor.role === 'ADMIN') return true;
  if (actor.role === 'TEACHER') {
    return target.role === 'STUDENT';
  }
  return false;
}

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

/**
 * Saves or updates a teacher exercise in Google Cloud Firestore.
 */
export async function saveExerciseToCloud(exercise: TeacherExercise): Promise<boolean> {
  try {
    const cleanId = exercise.id || `ex_${Date.now()}`;
    const cleanCode = (exercise.code || 'FK-' + Math.floor(1000 + Math.random() * 9000)).trim().toUpperCase();

    const cleanEx: TeacherExercise = {
      ...exercise,
      id: cleanId,
      code: cleanCode,
      title: String(exercise.title || '').trim(),
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    // Save primary document by ID
    const primaryRef = doc(db, EXERCISES_COLLECTION, cleanId);
    await setDoc(primaryRef, cleanEx, { merge: true });

    // Save secondary lookup by Code
    const codeSafeKey = `code_${cleanCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const codeRef = doc(db, EXERCISES_COLLECTION, codeSafeKey);
    await setDoc(codeRef, cleanEx, { merge: true });

    return true;
  } catch (err) {
    console.warn('Could not save exercise to Firestore:', err);
    return false;
  }
}

/**
 * Fetches all teacher exercises from Google Cloud Firestore.
 */
export async function fetchAllExercisesFromCloud(): Promise<TeacherExercise[]> {
  try {
    const colRef = collection(db, EXERCISES_COLLECTION);
    const snap = await getDocs(colRef);
    const exercises: TeacherExercise[] = [];
    const seen = new Set<string>();

    snap.forEach((docSnap) => {
      const data = docSnap.data() as TeacherExercise;
      if (data && data.id && data.title && data.code) {
        if (!seen.has(data.id)) {
          seen.add(data.id);
          exercises.push(data);
        }
      }
    });

    return exercises;
  } catch (err) {
    console.warn('Could not fetch exercises from Firestore:', err);
    return [];
  }
}

/**
 * Deletes an exercise from Google Cloud Firestore.
 */
export async function deleteExerciseFromCloud(exerciseId: string, code?: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, EXERCISES_COLLECTION, exerciseId));
    if (code) {
      const cleanCode = code.trim().toUpperCase();
      const codeSafeKey = `code_${cleanCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      await deleteDoc(doc(db, EXERCISES_COLLECTION, codeSafeKey));
    }
    return true;
  } catch (err) {
    console.warn('Could not delete exercise from Firestore:', err);
    return false;
  }
}
