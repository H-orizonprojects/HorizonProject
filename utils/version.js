/**
 * @layer L6 — Presentation
 * @class ResourceVersionManager
 * @pattern Singleton
 *
 * Manages revision versions for global resources (shop, faculty, etc.).
 * Allows for lightweight ETag-based conditional requests (304) by comparing
 * version strings instead of hashing full response bodies.
 *
 * Versions are cached in-memory for speed and persisted to the 'Config' collection.
 */

'use strict';

const Config = require('../models/Config');

class ResourceVersionManager {
    static #instance = null;
    #memoryCache = new Map();

    constructor() {
        if (ResourceVersionManager.#instance) {
            throw new Error('Use ResourceVersionManager.getInstance()');
        }
    }

    static getInstance() {
        if (!ResourceVersionManager.#instance) {
            ResourceVersionManager.#instance = new ResourceVersionManager();
        }
        return ResourceVersionManager.#instance;
    }

    /**
     * Gets the current version for a resource.
     * @param {string} resourceName
     * @returns {Promise<string>}
     */
    async getVersion(resourceName) {
        const key = `v_${resourceName}`;
        
        // Return from memory if available
        if (this.#memoryCache.has(key)) {
            return this.#memoryCache.get(key);
        }

        try {
            // Load from DB if not in memory
            let config = await Config.findOne({ key });
            if (!config) {
                // Initialize if missing
                config = new Config({ key, value: '1' });
                await config.save();
            }
            
            this.#memoryCache.set(key, config.value);
            return config.value;
        } catch (err) {
            console.error(`[VersionManager] Error getting version for ${resourceName}:`, err);
            return '0'; // Fallback to "always stale" or safe default
        }
    }

    /**
     * Increments the version for a resource (invalidates cache).
     * @param {string} resourceName
     */
    async increment(resourceName) {
        const key = `v_${resourceName}`;
        try {
            let config = await Config.findOne({ key });
            let nextVal = '1';

            if (config) {
                nextVal = (parseInt(config.value) + 1).toString();
                config.value = nextVal;
                await config.save();
            } else {
                config = new Config({ key, value: '1' });
                await config.save();
            }

            // Update memory cache
            this.#memoryCache.set(key, nextVal);
            console.log(`[VersionManager] Resource '${resourceName}' incremented to v${nextVal}`);
            return nextVal;
        } catch (err) {
            console.error(`[VersionManager] Error incrementing version for ${resourceName}:`, err);
        }
    }
}

module.exports = ResourceVersionManager.getInstance();
