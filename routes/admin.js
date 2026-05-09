/**
 * @layer L7 — Application
 * Admin API routes — maintenance mode toggle, etc.
 */

'use strict';

const router = require('express').Router();
const { isAuthenticated, hasRole } = require('../middleware/auth');
const maintenance = require('../middleware/maintenance');

// ── GET /api/admin/maintenance/status ──
// Public — used by maintenance.html to show message & countdown
router.get('/maintenance/status', (req, res) => {
    res.json(maintenance.getStatus());
});

// ── POST /api/admin/maintenance ──
// Toggle maintenance mode on/off (admin/professor only)
// Body: { action: "enable"|"disable", message?: string, until?: ISO-date }
router.post('/maintenance', isAuthenticated, hasRole(['admin', 'professor']), (req, res) => {
    const { action, message, until } = req.body;

    if (action === 'enable') {
        maintenance.enable({ message, until });
        return res.json({
            success: true,
            message: '🔒 Dashboard is now CLOSED for students.',
            status: maintenance.getStatus()
        });
    }

    if (action === 'disable') {
        maintenance.disable();
        return res.json({
            success: true,
            message: '🔓 Dashboard is now OPEN for students.',
            status: maintenance.getStatus()
        });
    }

    return res.status(400).json({ error: 'Invalid action. Use "enable" or "disable".' });
});

module.exports = router;
