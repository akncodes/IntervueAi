// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";

import { getAuth,GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDVsatZJigPzBBPN1Al-ooeHuXJ1u97lHQ",
  authDomain: "intervu-2373c.firebaseapp.com",
  projectId: "intervu-2373c",
  storageBucket: "intervu-2373c.firebasestorage.app",
  messagingSenderId: "776111970968",
  appId: "1:776111970968:web:9d6ef09d3bf25135138eed",
  measurementId: "G-H17G5T7TH6"
};
const app = !getApps.length ?  initializeApp(firebaseConfig) : getApp();

export const provider = new GoogleAuthProvider();
export const auth = getAuth(app);
auth.languageCode = 'en';
export const db = getFirestore(app);

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    const user = result.user;

    const idToken = await user.getIdToken();

    // Send to server to store in DB and set session
    await fetch("/api/google-auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        idToken,
      }),
    });

    return { user, token, idToken }; // ✅ returning all
  } catch (error) {
    console.error("Error signing in with Google: ", error);
    throw error;
  }
};