import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG_PREFIX = 'chunk-reload:';

/**
 * Wraps a `React.lazy` dynamic import so a stale deployment doesn't strand users on a raw
 * "Failed to fetch dynamically imported module" error page. When a new build goes live, the
 * old hashed chunk filenames referenced by an already-open tab's index.html stop existing on
 * the server (Vercel serves only the current deployment's assets) — the next navigation that
 * lazy-loads one of those chunks 404s.
 *
 * Recover by reloading the page once: that fetches the current index.html, which points at
 * the current build's chunk hashes. A sessionStorage flag, keyed per chunk, makes sure a
 * genuinely broken module (bad network, real bug) fails normally on the second attempt
 * instead of reload-looping forever.
 */
export function lazyWithReload<T extends { default: ComponentType<unknown> }>(
  factory: () => Promise<T>,
  chunkId: string
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const flagKey = `${RELOAD_FLAG_PREFIX}${chunkId}`;
      if (!sessionStorage.getItem(flagKey)) {
        sessionStorage.setItem(flagKey, '1');
        window.location.reload();
        // Keep this lazy() promise pending during the (sub-second) reload so React doesn't
        // flash an error state right before the page navigates away.
        return new Promise<T>(() => {});
      }
      throw err;
    }
  });
}
