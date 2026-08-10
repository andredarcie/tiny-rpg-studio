import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureFirebase } from '../../runtime/infra/share/FirebaseLoader';

type FirebaseEnsureGlobal = typeof globalThis & {
  TinyRPGEnsureFirebase?: () => Promise<boolean>;
};

const firebaseGlobal = globalThis as FirebaseEnsureGlobal;

describe('ensureFirebase', () => {
  afterEach(() => {
    delete firebaseGlobal.TinyRPGEnsureFirebase;
  });

  it('resolves false when the lazy Firebase loader rejects', async () => {
    firebaseGlobal.TinyRPGEnsureFirebase = vi.fn(() =>
      Promise.reject(new TypeError("Cannot read properties of undefined (reading 'initializeApp')")),
    );

    await expect(ensureFirebase()).resolves.toBe(false);
  });
});
