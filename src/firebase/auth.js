import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

export const registerUser = async ({ name, email, password, participantId }) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  await setDoc(doc(db, 'users', cred.user.uid), {
    name,
    email,
    participantId: participantId || '',
    cash: 200000,          // ₹2,00,000 Mudra Coins
    role: 'student',
    joinedAt: serverTimestamp(),
  });

  return cred.user;
};

export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logoutUser = () => signOut(auth);

export const getUserData = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
};
