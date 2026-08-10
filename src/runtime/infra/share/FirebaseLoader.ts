/**
 * Thin TypeScript bridge to the lazy Firebase loader defined in `index.html`.
 *
 * Firebase is intentionally kept off the boot critical path: `index.html` only
 * defines `window.TinyRPGFirebaseConfig` and a memoized `window.TinyRPGEnsureFirebase()`
 * that dynamically imports the SDK from the CDN the first time it is called. This
 * helper triggers that loader and resolves once the `window.TinyRPGFirebase*`
 * globals are populated, so callers (e.g. share-URL tracking) can `await` it
 * before using Firestore. See AP-1 in `PERFORMANCE_REPORT.md`.
 */

type FirebaseEnsureGlobal = typeof globalThis & {
  TinyRPGEnsureFirebase?: () => Promise<boolean>;
};

/**
 * Loads Firebase on demand (memoized). Resolves `false` when no loader is present
 * (e.g. exported single-file builds), so callers degrade gracefully.
 */
export function ensureFirebase(): Promise<boolean> {
  const loader = (globalThis as FirebaseEnsureGlobal).TinyRPGEnsureFirebase;
  if (typeof loader !== 'function') return Promise.resolve(false);
  try {
    return loader().catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}
