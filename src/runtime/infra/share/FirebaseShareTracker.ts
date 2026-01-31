
type FirebaseCompatApp = {
  collection: (name: string) => { add: (payload: unknown) => Promise<unknown> };
};

type FirebaseCompatInstance = {
  apps?: unknown[];
  app?: () => FirebaseCompatApp;
  initializeApp?: (...args: unknown[]) => FirebaseCompatApp;
  firestore?: () => FirebaseCompatApp;
  FieldValue?: { serverTimestamp?: () => unknown };
};

type FirebaseModuleHelpers = {
  addDoc?: (...args: unknown[]) => Promise<unknown>;
  collection?: (...args: unknown[]) => unknown;
  serverTimestamp?: () => unknown;
};

type TrackerOptions = {
  collection?: string | null;
};

type TinyRpgGlobal = typeof globalThis & {
  TinyRPGFirebaseConfig?: Record<string, unknown> | null;
  TinyRPGFirebaseCollection?: string | null;
  TinyRPGFirebaseDb?: FirebaseCompatApp | null;
  TinyRPGFirebaseFirestore?: FirebaseModuleHelpers | null;
  firebase?: FirebaseCompatInstance | null;
};

const tinyRpgGlobal = globalThis as TinyRpgGlobal;

class FirebaseShareTracker {
  config: Record<string, unknown> | null;
  collection: string;
  app: FirebaseCompatApp | null;
  db: FirebaseCompatApp | null;
  mode: 'modular' | 'compat' | null;
  firestoreHelpers: FirebaseModuleHelpers | null;

  constructor(config: Record<string, unknown> | null = null, options: TrackerOptions = {}) {
    this.config = config || null;
    this.collection = options.collection || 'shareUrls';
    this.app = null;
    this.db = null;
    this.mode = null;
    this.firestoreHelpers = null;
    this.init();
  }

  static fromGlobal(): FirebaseShareTracker {
    const config = tinyRpgGlobal.TinyRPGFirebaseConfig ?? null;
    const collection = tinyRpgGlobal.TinyRPGFirebaseCollection ?? null;
    return new FirebaseShareTracker(config, { collection });
  }

  get firebase(): FirebaseCompatInstance | null {
    return tinyRpgGlobal.firebase ?? null;
  }

  init(): boolean {
    if (this.initFromModule()) return true;
    if (!this.config) return false;
    return this.initFromCompat();
  }

  initFromModule(): boolean {
    const db = tinyRpgGlobal.TinyRPGFirebaseDb ?? null;
    const helpers = tinyRpgGlobal.TinyRPGFirebaseFirestore;
    if (!db || !helpers || !helpers.addDoc || !helpers.collection) return false;
    this.db = db;
    this.firestoreHelpers = helpers;
    this.mode = 'modular';
    console.info('[TinyRPG] Firebase tracker initialized (modular).');
    return true;
  }

  initFromCompat(): boolean {
    const firebase = this.firebase;
    if (!firebase || !firebase.initializeApp) {
      console.warn('[TinyRPG] Firebase SDK not available.');
      return false;
    }
    let app: FirebaseCompatApp | null = null;
    try {
      if (firebase.apps && firebase.apps.length) {
        const appFactory = firebase.app;
        app = appFactory ? appFactory() : null;
      } else {
        const initializer = firebase.initializeApp;
        app = initializer(this.config);
      }
    } catch (error) {
      console.warn('[TinyRPG] Firebase init failed.', error);
      return false;
    }
    this.app = app;
    const firestoreFactory = firebase.firestore;
    if (!firestoreFactory) {
      console.warn('[TinyRPG] Firebase Firestore not available.');
      return false;
    }
    const firestoreInstance = firestoreFactory();
    this.db = firestoreInstance;
    this.mode = 'compat';
    console.info('[TinyRPG] Firebase tracker initialized (compat).');
    return true;
  }

  buildPayload(url: string, metadata: Record<string, unknown> = {}): Record<string, unknown> {
    const serverTimestamp = this.mode === 'modular'
      ? this.firestoreHelpers?.serverTimestamp
      : this.firebase?.FieldValue?.serverTimestamp;
    return {
      url,
      createdAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      language: typeof navigator !== 'undefined' ? navigator.language : '',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      ...metadata,
    };
  }

  async trackShareUrl(url: string, metadata: Record<string, unknown> = {}): Promise<boolean> {
    if (!url) return false;
    if (!this.db) {
      this.init();
    }
    if (!this.db) return false;
    try {
      const payload = this.buildPayload(url, metadata);
      if (this.mode === 'modular') {
        const { addDoc, collection } = this.firestoreHelpers ?? {};
        if (addDoc && collection) {
          const collectionRef = collection(this.db, this.collection);
          await addDoc(collectionRef, payload);
        }
      } else if (typeof this.db.collection === 'function') {
        await this.db.collection(this.collection).add(payload);
      }
      console.info('[TinyRPG] Share URL tracked.', { url, collection: this.collection });
      return true;
    } catch (error) {
      console.warn('[TinyRPG] Failed to track share URL.', error);
      return false;
    }
  }
}

export { FirebaseShareTracker };
