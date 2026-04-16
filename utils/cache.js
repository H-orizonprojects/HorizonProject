/**
 * @layer L6 — Presentation
 * @class CacheManager
 * @pattern Singleton
 *
 * A lightweight, zero-dependency, in-process TTL cache backed by a native Map.
 * Used to cache `GET /api/shop/items` results between requests on the same
 * warm Vercel function instance — eliminating repeated MongoDB round-trips for
 * data that rarely changes.
 *
 * Trade-offs (free tier safe):
 *   - No external Redis/Memcached needed → zero extra cost
 *   - Cache is per-instance and resets on cold start (acceptable: first request
 *     after cold start repopulates it immediately)
 *   - Cache is explicitly invalidated on any admin write (add/edit/delete item)
 *     so users always see up-to-date data after mutations
 *
 * Default TTL: 60 seconds for shop items.
 */

'use strict';

/** @typedef {{ value: any, expiresAt: number }} CacheEntry */

class CacheManager {
    /** @type {CacheManager} */
    static #instance = null;

    /** @type {Map<string, CacheEntry>} */
    #store = new Map();

    constructor() {
        if (CacheManager.#instance) {
            throw new Error('Use CacheManager.getInstance()');
        }
    }

    /**
     * Returns the singleton instance.
     * @returns {CacheManager}
     */
    static getInstance() {
        if (!CacheManager.#instance) {
            CacheManager.#instance = new CacheManager();
        }
        return CacheManager.#instance;
    }

    /**
     * Stores a value under the given key with a TTL.
     * @param {string} key
     * @param {any} value
     * @param {number} [ttlMs=60000] — Time to live in milliseconds (default 60 s)
     */
    set(key, value, ttlMs = 60_000) {
        this.#store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
    }

    /**
     * Retrieves the cached value for the key, or null if missing / expired.
     * Expired entries are lazily deleted on access.
     * @param {string} key
     * @returns {any | null}
     */
    get(key) {
        const entry = this.#store.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.#store.delete(key);
            return null;
        }

        return entry.value;
    }

    /**
     * Explicitly removes an entry from the cache (e.g. after a write mutation).
     * @param {string} key
     */
    invalidate(key) {
        this.#store.delete(key);
    }

    /**
     * Clears all cached entries.
     */
    flush() {
        this.#store.clear();
    }

    /**
     * Returns the number of alive (non-expired) entries currently in cache.
     * @returns {number}
     */
    get size() {
        const now = Date.now();
        let alive = 0;
        for (const entry of this.#store.values()) {
            if (now <= entry.expiresAt) alive++;
        }
        return alive;
    }
}

module.exports = CacheManager.getInstance();
