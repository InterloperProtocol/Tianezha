import { type Firestore } from "firebase-admin/firestore";

import { getServerEnv, isFirebaseConfigured, isProductionEnv } from "@/lib/env";
import { getConfiguredFirestore } from "@/lib/server/firestore-admin";
import { FIRESTORE_SIM_COLLECTIONS } from "@/lib/simulation/constants";

type SimCollectionName =
  (typeof FIRESTORE_SIM_COLLECTIONS)[keyof typeof FIRESTORE_SIM_COLLECTIONS];

type SimMemoryStore = Record<SimCollectionName, Map<string, unknown>>;

declare global {
  var __tianezhaSimulationStore: SimMemoryStore | undefined;
}

function createMemoryStore(): SimMemoryStore {
  return Object.values(FIRESTORE_SIM_COLLECTIONS).reduce((store, collectionName) => {
    store[collectionName] = new Map<string, unknown>();
    return store;
  }, {} as SimMemoryStore);
}

function getMemoryStore() {
  if (!global.__tianezhaSimulationStore) {
    global.__tianezhaSimulationStore = createMemoryStore();
  }

  return global.__tianezhaSimulationStore;
}

function getAdminDb() {
  if (!isFirebaseConfigured()) {
    return null;
  }

  return getConfiguredFirestore();
}

function isFirestoreUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("cloud firestore api has not been used") ||
    message.includes("firestore api") ||
    message.includes("service_disabled") ||
    message.includes("permission_denied") ||
    message.includes("failed_precondition") ||
    message.includes("the database") ||
    message.includes("firestore.googleapis.com")
  );
}

function logFirestoreFallback(action: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(
    `[tianezha-sim-store] ${action}: Firestore unavailable, falling back to memory. ${detail}`,
  );
}

function shouldAllowMemoryFallback() {
  return !isProductionEnv();
}

async function withSimulationBackend<T>(
  action: string,
  fallback: () => Promise<T> | T,
  dbAction: (db: Firestore) => Promise<T>,
) {
  const db = getAdminDb();
  if (!db) {
    return await fallback();
  }

  try {
    return await dbAction(db);
  } catch (error) {
    if (isFirestoreUnavailableError(error)) {
      if (!shouldAllowMemoryFallback()) {
        throw new Error(
          `Persistent simulation storage is unavailable during ${action}; refusing memory fallback in production.`,
        );
      }

      logFirestoreFallback(action, error);
      return await fallback();
    }

    throw error;
  }
}

export async function simGet<T>(collectionName: SimCollectionName, id: string) {
  return withSimulationBackend(
    `simGet:${collectionName}`,
    () => (getMemoryStore()[collectionName].get(id) as T | undefined) ?? null,
    async (db) => {
      const doc = await db.collection(collectionName).doc(id).get();
      return doc.exists ? ((doc.data() as T) ?? null) : null;
    },
  );
}

export async function simList<T>(collectionName: SimCollectionName) {
  return withSimulationBackend(
    `simList:${collectionName}`,
    () => [...getMemoryStore()[collectionName].values()] as T[],
    async (db) => {
      const snapshot = await db.collection(collectionName).get();
      return snapshot.docs.map((doc) => doc.data() as T);
    },
  );
}

export async function simUpsert<T extends { id: string }>(
  collectionName: SimCollectionName,
  record: T,
) {
  return withSimulationBackend(
    `simUpsert:${collectionName}`,
    () => {
      getMemoryStore()[collectionName].set(record.id, record);
      return record;
    },
    async (db) => {
      await db.collection(collectionName).doc(record.id).set(record, { merge: true });
      return record;
    },
  );
}

export async function simDelete(collectionName: SimCollectionName, id: string) {
  return withSimulationBackend(
    `simDelete:${collectionName}`,
    () => {
      getMemoryStore()[collectionName].delete(id);
      return true;
    },
    async (db) => {
      await db.collection(collectionName).doc(id).delete();
      return true;
    },
  );
}

export async function simFindOne<T>(
  collectionName: SimCollectionName,
  predicate: (record: T) => boolean,
) {
  const records = await simList<T>(collectionName);
  return records.find(predicate) ?? null;
}

export async function simFilter<T>(
  collectionName: SimCollectionName,
  predicate: (record: T) => boolean,
) {
  const records = await simList<T>(collectionName);
  return records.filter(predicate);
}

export function getSimulationOwnerWallet() {
  return getServerEnv().TIANSHI_OWNER_WALLET;
}
