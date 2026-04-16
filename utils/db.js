/**
 * @layer L2 — Data Link
 * @class ConnectionManager
 * @pattern Singleton
 *
 * Manages the MongoDB / Mongoose connection lifecycle.
 * On Vercel (serverless), Node.js modules are cached between warm invocations
 * of the same function instance. This singleton ensures we reuse an existing
 * connection rather than re-opening one on every request, eliminating the
 * ~200–800 ms reconnect overhead for warm calls.
 *
 * Cold start: connect() establishes a fresh connection.
 * Warm start: connect() detects readyState === 1 and returns immediately.
 */

'use strict';

const mongoose = require('mongoose');

class ConnectionManager {
    /** @type {ConnectionManager} */
    static #instance = null;

    /** @type {boolean} */
    #isConnected = false;

    /** @type {import('mongodb').MongoClient | null} */
    #client = null;

    constructor() {
        if (ConnectionManager.#instance) {
            throw new Error('Use ConnectionManager.getInstance()');
        }
    }

    /**
     * Returns the singleton instance.
     * @returns {ConnectionManager}
     */
    static getInstance() {
        if (!ConnectionManager.#instance) {
            ConnectionManager.#instance = new ConnectionManager();
        }
        return ConnectionManager.#instance;
    }

    /**
     * Establishes (or reuses) the Mongoose connection.
     * Safe to call multiple times — subsequent calls on a live connection
     * return immediately without creating a new pool.
     *
     * @returns {Promise<import('mongodb').MongoClient>}
     */
    async connect() {
        // Warm invocation: connection already alive — reuse it
        if (this.#isConnected && mongoose.connection.readyState === 1) {
            return this.#client;
        }

        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('CRITICAL: MONGODB_URI is not defined in environment variables!');
        }

        const conn = await mongoose.connect(uri, {
            maxPoolSize: 5,               // Safe for Atlas M0 free tier
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        this.#client = conn.connection.getClient();
        this.#isConnected = true;

        console.log('[ConnectionManager] ✅ MongoDB connected');
        return this.#client;
    }

    /**
     * Returns the raw MongoClient (for MongoStore session store).
     * @returns {import('mongodb').MongoClient | null}
     */
    getClient() {
        return this.#client;
    }

    /**
     * Returns whether the connection is currently alive.
     * @returns {boolean}
     */
    get isConnected() {
        return this.#isConnected && mongoose.connection.readyState === 1;
    }
}

module.exports = ConnectionManager.getInstance();
