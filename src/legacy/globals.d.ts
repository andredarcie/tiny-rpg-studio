type TinyRpgFirebaseHelpers = {
  addDoc?: (...args: unknown[]) => Promise<unknown>;
  collection?: (...args: unknown[]) => unknown;
  serverTimestamp?: () => unknown;
  getDocs?: (...args: unknown[]) => Promise<unknown>;
  query?: (...args: unknown[]) => unknown;
  orderBy?: (...args: unknown[]) => unknown;
  limit?: (...args: unknown[]) => unknown;
  startAfter?: (...args: unknown[]) => unknown;
};

declare global {
  interface GlobalThis {
    TEXT_BUNDLES?: Record<string, Record<string, string>>;
    __TINY_RPG_EXPORT_MODE?: boolean;
    __TINY_RPG_SHARED_CODE?: string;
    TinyRPGFirebaseConfig?: Record<string, unknown> | null;
    TinyRPGFirebaseCollection?: string | null;
    TinyRPGFirebaseGamesCollection?: string | null;
    TinyRPGFirebaseApp?: unknown;
    TinyRPGFirebaseDb?: unknown;
    TinyRPGFirebaseFirestore?: TinyRpgFirebaseHelpers | null;
    firebase?: {
      initializeApp?: (...args: unknown[]) => unknown;
      apps?: unknown[];
      app?: () => unknown;
      firestore?: () => {
        collection: (...args: unknown[]) => { add: (...args: unknown[]) => Promise<unknown> };
        FieldValue?: { serverTimestamp?: () => unknown };
      };
    } | null;
    TinyRPGMaker?: Record<string, unknown>;
    TinyRPGShare?: Record<string, unknown>;
    TinyRPGApplication?: Record<string, unknown>;
  }
}

export {};
