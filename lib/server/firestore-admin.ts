import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";

import { isFirebaseConfigured } from "@/lib/env";

declare global {
  var __tianezhaAdminDb: Firestore | null | undefined;
}

function getOrInitializeAdminApp() {
  return getApps().length > 0
    ? getApp()
    : process.env.FIREBASE_CONFIG
      ? initializeApp()
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
          }),
          projectId: process.env.FIREBASE_PROJECT_ID!,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
        });
}

export function getConfiguredFirestore() {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (global.__tianezhaAdminDb !== undefined) {
    return global.__tianezhaAdminDb;
  }

  const db = getFirestore(getOrInitializeAdminApp());
  db.settings({
    ignoreUndefinedProperties: true,
  });
  global.__tianezhaAdminDb = db;
  return db;
}
