/**
 * @layer L4 — Transport
 * Maintenance Mode Middleware
 * 
 * Reads the `dashboard_closed` Config from MongoDB (same as the existing
 * admin toggle in routes/users.js) and blocks student access when enabled.
 * Admins and Professors can still access the dashboard.
 */

'use strict';

const Config = require('../models/Config');

// ── In-memory cache to avoid hitting DB on every request ──
let _cache = { isClosed: false, message: '', checkedAt: 0 };
const CACHE_TTL = 10 * 1000; // 10 seconds — short enough to pick up changes quickly

/**
 * Refresh the cached status from MongoDB (if stale).
 */
async function refreshCache() {
    const now = Date.now();
    if (now - _cache.checkedAt < CACHE_TTL) return _cache;

    try {
        const config = await Config.findOne({ key: 'dashboard_closed' }).lean();
        _cache = {
            isClosed: config?.value === true,
            message: config?.message || '🏰 ระบบปิดชั่วคราว กรุณารอสักครู่...',
            checkedAt: now
        };
    } catch (err) {
        console.error('[Maintenance] Failed to read config:', err.message);
        // On error, keep previous cache state
        _cache.checkedAt = now;
    }

    return _cache;
}

/**
 * Middleware: blocks non-admin users when dashboard_closed config is true.
 * Admins/Professors pass through normally.
 */
async function maintenanceGuard(req, res, next) {
    const status = await refreshCache();

    if (!status.isClosed) return next();

    // Allow admins and professors through
    const userRoles = req.user?.roles || [];
    if (userRoles.includes('admin') || userRoles.includes('professor')) {
        return next();
    }

    // Check if this is an API request
    const isApi = req.originalUrl.startsWith('/api/')
        || (req.headers['accept'] && req.headers['accept'].includes('application/json'));

    if (isApi) {
        return res.status(503).json({
            error: 'maintenance',
            message: status.message
        });
    }

    // Serve the maintenance page for browser requests
    const path = require('path');
    return res.status(503).sendFile(path.join(__dirname, '..', 'maintenance.html'));
}

module.exports = { maintenanceGuard };
