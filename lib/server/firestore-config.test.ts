import { beforeEach, describe, expect, it, vi } from "vitest";

const envModule = vi.hoisted(() => ({
  getServerEnv: vi.fn(() => ({
    DEVICE_CREDENTIALS_AES_KEY: "12345678901234567890123456789012",
    FIREBASE_PROJECT_ID: "tianezha-app",
  })),
  isFirebaseConfigured: vi.fn(() => true),
  isProductionEnv: vi.fn(() => false),
}));

const appModule = vi.hoisted(() => {
  const app = { name: "test-app" };
  return {
    app,
    cert: vi.fn((value) => value),
    getApp: vi.fn(() => app),
    getApps: vi.fn(() => []),
    initializeApp: vi.fn(() => app),
  };
});

const firestoreModule = vi.hoisted(() => {
  const db = {
    settings: vi.fn(),
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn(async () => undefined),
      })),
    })),
  };

  return {
    db,
    FieldValue: {
      delete: vi.fn(() => "__delete__"),
    },
    getFirestore: vi.fn(() => db),
  };
});

vi.mock("@/lib/env", () => envModule);
vi.mock("firebase-admin/app", () => appModule);
vi.mock("firebase-admin/firestore", () => firestoreModule);

describe("Firestore admin configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIREBASE_PROJECT_ID = "tianezha-app";
    process.env.FIREBASE_CLIENT_EMAIL = "firestore@test.invalid";
    process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----";
    delete process.env.FIREBASE_CONFIG;
    (globalThis as { __tianezhaAdminDb?: unknown }).__tianezhaAdminDb = undefined;
    (globalThis as { __tianshiMemory?: unknown }).__tianshiMemory = undefined;
    (globalThis as { __tianezhaSimulationStore?: unknown }).__tianezhaSimulationStore = undefined;
  });

  it("initializes repository Firestore with ignoreUndefinedProperties enabled", async () => {
    const { upsertBitClawProfile } = await import("@/lib/server/repository");

    await upsertBitClawProfile({
      id: "profile-1",
      authorType: "human",
      authType: "guest",
      guestId: "guest-1",
      handle: "guest-1",
      displayName: "Guest 1",
      bio: "Bio",
      avatarUrl: null,
      accentLabel: "Human",
      subscriptionLabel: "Community reply",
      isAutonomous: false,
      createdAt: "2026-03-27T00:00:00.000Z",
      updatedAt: "2026-03-27T00:00:00.000Z",
    });

    expect(firestoreModule.getFirestore).toHaveBeenCalledWith(appModule.app);
    expect(firestoreModule.db.settings).toHaveBeenCalledWith({
      ignoreUndefinedProperties: true,
    });
  });

  it("initializes simulation Firestore with ignoreUndefinedProperties enabled", async () => {
    const { simUpsert } = await import("@/lib/server/tianezha-sim-store");

    await simUpsert("identityProfiles", {
      id: "profile-1",
      displayName: "Guest 1",
    });

    expect(firestoreModule.getFirestore).toHaveBeenCalledWith(appModule.app);
    expect(firestoreModule.db.settings).toHaveBeenCalledWith({
      ignoreUndefinedProperties: true,
    });
  });
});
