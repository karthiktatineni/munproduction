import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    });
}

const db = admin.firestore();
const auth = admin.auth();

export { db, auth, admin };
