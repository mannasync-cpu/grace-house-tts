import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDmYdnNHANHlj4V0HB61ystZGsh5gByRUM",
  authDomain: "grace-house-devotionals.firebaseapp.com",
  projectId: "grace-house-devotionals",
  storageBucket: "grace-house-devotionals.firebasestorage.app",
  messagingSenderId: "543879258049",
  appId: "1:543879258049:web:340324edc810c2772bd940",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
