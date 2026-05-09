/**
 * @layer L4 — Transport
 * Maintenance Mode Middleware
 * 
 * Blocks student access to the dashboard temporarily (e.g., end of semester).
 * Admins and Professors can still access the dashboard.
 * 
 * Toggle via:
 *   - Environment variable: MAINTENANCE_MODE=true
 *   - API endpoint: POST /api/admin/maintenance (requires admin role)
 */

'use strict';

// ── In-memory state (survives until server restart) ──
let maintenanceEnabled = process.env.MAINTENANCE_MODE === 'true';
let maintenanceMessage = process.env.MAINTENANCE_MESSAGE 
    || '🏰 The Magical Dashboard is temporarily closed for the end-of-semester break. Please check back when the new term begins!';
let maintenanceUntil = process.env.MAINTENANCE_UNTIL || null; // ISO date string, e.g. "2026-06-01T00:00:00Z"

/**
 * Check if maintenance mode is currently active.
 * If a `maintenanceUntil` date is set, maintenance auto-disables after that date.
 */
function isMaintenanceActive() {
    if (!maintenanceEnabled) return false;

    // Auto-disable if the scheduled end date has passed
    if (maintenanceUntil) {
        const endDate = new Date(maintenanceUntil);
        if (!isNaN(endDate.getTime()) && Date.now() >= endDate.getTime()) {
            maintenanceEnabled = false;
            console.log('[Maintenance] ⏰ Scheduled maintenance period has ended — auto-disabled.');
            return false;
        }
    }

    return true;
}

/**
 * Middleware: blocks non-admin users from accessing the dashboard.
 * Admins/Professors pass through normally.
 */
function maintenanceGuard(req, res, next) {
    if (!isMaintenanceActive()) return next();

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
            message: maintenanceMessage,
            until: maintenanceUntil || null
        });
    }

    // Serve the maintenance page for browser requests
    const path = require('path');
    return res.status(503).sendFile(path.join(__dirname, '..', 'maintenance.html'));
}

// ── Getters & Setters (used by admin API route) ──

function getStatus() {
    return {
        enabled: isMaintenanceActive(),
        message: maintenanceMessage,
        until: maintenanceUntil
    };
}

function enable(options = {}) {
    maintenanceEnabled = true;
    if (options.message) maintenanceMessage = options.message;
    if (options.until) maintenanceUntil = options.until;
    console.log(`[Maintenance] 🔒 Dashboard LOCKED — ${maintenanceMessage}`);
    if (maintenanceUntil) console.log(`[Maintenance] ⏰ Until: ${maintenanceUntil}`);
}

function disable() {
    maintenanceEnabled = false;
    console.log('[Maintenance] 🔓 Dashboard UNLOCKED — students can access again.');
}

module.exports = { maintenanceGuard, getStatus, enable, disable };
