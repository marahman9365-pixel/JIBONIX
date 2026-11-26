import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBpqNjf9btF67vudpHWczR5IpNKKdhyn5o",
    authDomain: "jibonix-app-4c80b.firebaseapp.com",
    projectId: "jibonix-app-4c80b",
    storageBucket: "jibonix-app-4c80b.firebasestorage.app",
    messagingSenderId: "314983336324",
    appId: "1:314983336324:web:5d8ac1d8aa4edc10b835d1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Offline-First Architecture (SRS 3.1)
enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Offline persistence warning:", err.code);
});
