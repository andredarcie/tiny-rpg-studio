
import { ShareDecoder } from './ShareDecoder';

type FirebaseGamesGlobal = typeof globalThis & {
  TinyRPGFirebaseDb?: unknown;
  TinyRPGFirebaseFirestore?: {
    collection?: (...args: unknown[]) => unknown;
    getDocs?: (...args: unknown[]) => Promise<unknown>;
    query?: (...args: unknown[]) => unknown;
    orderBy?: (...args: unknown[]) => unknown;
    limit?: (...args: unknown[]) => unknown;
    startAfter?: (...args: unknown[]) => unknown;
    addDoc?: (...args: unknown[]) => Promise<unknown>;
    serverTimestamp?: () => unknown;
  } | null;
  TinyRPGFirebaseGamesCollection?: string | null;
};

export type GameEntry = {
  id: string;
  url: string;
  title: string;
  author: string;
  gameData: Record<string, unknown> | null;
  coverImage?: string;
  createdAt?: Date;
};

export type GamesPage = {
  games: GameEntry[];
  cursor: unknown;
  hasMore: boolean;
};

const PAGE_SIZE = 12;
const g = globalThis as FirebaseGamesGlobal;

class FirebaseGamesService {
  static get collectionName(): string {
    return g.TinyRPGFirebaseGamesCollection ?? 'games';
  }

  static isAvailable(): boolean {
    const h = g.TinyRPGFirebaseFirestore;
    const db = g.TinyRPGFirebaseDb;
    return !!(db && h && h.getDocs && h.query && h.collection && h.orderBy && h.limit);
  }

  static extractShareCode(url: string): string | null {
    if (!url) return null;
    const hash = url.indexOf('#');
    if (hash !== -1) return url.slice(hash + 1) || null;
    return url.trim() || null;
  }

  private static decodeEntry(shareCode: string): {
    title: string;
    author: string;
    gameData: Record<string, unknown> | null;
  } {
    try {
      const data = ShareDecoder.decodeShareCode(shareCode);
      if (data && typeof data === 'object') {
        const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : '';
        const author = typeof data.author === 'string' && data.author.trim() ? data.author.trim() : '';
        return { title, author, gameData: data };
      }
    } catch {
      // ignore decode errors for malformed URLs
    }
    return { title: '', author: '', gameData: null };
  }

  static async fetchPage(cursor?: unknown): Promise<GamesPage> {
    const h = g.TinyRPGFirebaseFirestore;
    const db = g.TinyRPGFirebaseDb;

    if (!db || !h || !h.getDocs || !h.query || !h.collection || !h.orderBy || !h.limit) {
      return { games: [], cursor: null, hasMore: false };
    }

    try {
      const collRef = (h.collection as (...a: unknown[]) => unknown)(db, this.collectionName);
      const constraints: unknown[] = [
        (h.orderBy as (...a: unknown[]) => unknown)('createdAt', 'desc'),
        (h.limit as (...a: unknown[]) => unknown)(PAGE_SIZE + 1),
      ];
      if (cursor && h.startAfter) {
        constraints.push((h.startAfter as (...a: unknown[]) => unknown)(cursor));
      }
      const q = (h.query as (...a: unknown[]) => unknown)(collRef, ...constraints);
      const snapshot = await (h.getDocs as (...a: unknown[]) => Promise<{
        docs: Array<{ id: string; data: () => Record<string, unknown> }>;
      }>)(q);

      const docs = snapshot.docs;
      const hasMore = docs.length > PAGE_SIZE;
      const pageItems = hasMore ? docs.slice(0, PAGE_SIZE) : docs;
      const newCursor = pageItems.length > 0 ? pageItems[pageItems.length - 1] : null;

      const games: GameEntry[] = pageItems.map(doc => {
        const d = doc.data();
        const ts = d.createdAt as { toDate?: () => Date } | null | undefined;
        const url = String(d.url ?? '');
        const shareCode = this.extractShareCode(url);
        const decoded = shareCode ? this.decodeEntry(shareCode) : { title: '', author: '', gameData: null };
        return {
          id: doc.id,
          url,
          title: decoded.title || 'Untitled',
          author: decoded.author || 'Anonymous',
          gameData: decoded.gameData,
          coverImage: d.coverImage ? String(d.coverImage) : undefined,
          createdAt: ts?.toDate?.(),
        };
      });

      return { games, cursor: newCursor, hasMore };
    } catch (err) {
      console.warn('[TinyRPG] Failed to fetch games list.', err);
      return { games: [], cursor: null, hasMore: false };
    }
  }
}

export { FirebaseGamesService };
