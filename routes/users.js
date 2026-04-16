/**
 * @layer L7 — Application
 * User routes.
 *
 * Performance fix applied:
 * - GET /faculty no longer performs a DB write on every request (write-on-read removed).
 *   Write only occurs on first-time initialization (no config document exists yet).
 */

'use strict';

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Config = require('../models/Config');
const { isAuthenticated, hasRole } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

// Lightweight: get current user's inventory only (avoids calling /auth/me repeatedly)
router.get('/me/inventory', async (req, res) => {
    if (!req.user || !req.user.id) return res.status(401).json({ message: 'Unauthorized' });
    try {
        const user = await User.findById(req.user.id)
            .select('inventory')
            .populate('inventory.itemId', 'name image type rarity');
        res.json({ inventory: user.inventory || [] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET dashboard status
router.get('/dashboard/status', async (req, res) => {
    try {
        const config = await Config.findOne({ key: 'dashboard_closed' });
        res.json({
            isClosed: config?.value === true,
            message: config?.message || 'ระบบปิดชั่วคราว กรุณารอสักครู่...'
        });
    } catch (err) {
        res.json({ isClosed: false });
    }
});

// POST toggle dashboard (admin/professor only)
router.post('/dashboard/toggle', isAuthenticated, hasRole(['admin', 'professor']), sanitizeBody, async (req, res) => {
    try {
        const { isClosed, message } = req.body;
        let config = await Config.findOne({ key: 'dashboard_closed' });
        if (!config) {
            config = new Config({ key: 'dashboard_closed', value: !!isClosed, message: message || '' });
        } else {
            config.value = !!isClosed;
            if (message !== undefined) config.message = message;
            config.markModified('value');
        }
        await config.save();
        res.json({ message: `Dashboard ${isClosed ? 'ปิด' : 'เปิด'} สำเร็จ` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all users by house (for house roster)
router.get('/house/:houseName', async (req, res) => {
    const houseName = req.params.houseName.toLowerCase();
    const validHouses = ['garuda', 'naga', 'qilin', 'erawan'];

    if (!validHouses.includes(houseName)) {
        return res.status(400).json({ message: 'Invalid house name' });
    }

    try {
        const users = await User.find({
            roles: houseName
        }).select('-_id discordId username avatar balance roles house').sort({ username: 1 });

        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get top 3 users by balance (excluding admins)
router.get('/top', async (req, res) => {
    try {
        const topUsers = await User.find({ roles: { $ne: 'admin' } })
            .select('-_id username balance roles house avatar')
            .sort({ balance: -1 })
            .limit(3);
        res.json(topUsers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all users (admin only)


router.get('/all', isAuthenticated, hasRole(['admin', 'professor']), async (req, res) => {
    try {
        const users = await User.find().select('-_id discordId username avatar balance roles house').sort({ username: 1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// User: Change display name via item
router.post('/changeName', isAuthenticated, sanitizeBody, async (req, res) => {
    const { itemId, newName } = req.body;
    if (!newName || newName.length < 2 || newName.length > 50) return res.status(400).json({ message: 'Invalid name length.' });

    try {
        const user = await User.findById(req.user.id);
        const itemIdx = user.inventory.findIndex(i => i.itemId.toString() === itemId);

        if (itemIdx === -1 || user.inventory[itemIdx].quantity < 1) {
            return res.status(400).json({ message: 'You do not have a Name Change Card.' });
        }

        // Deduct 1 item
        user.inventory[itemIdx].quantity -= 1;
        if (user.inventory[itemIdx].quantity <= 0) {
            user.inventory.splice(itemIdx, 1);
        }
        user.markModified('inventory');
        user.username = newName;

        await user.save();
        res.json({ message: 'Name changed successfully', username: user.username });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Admin: Adjust user health
router.post('/admin/health', isAuthenticated, hasRole(['admin', 'professor']), sanitizeBody, async (req, res) => {
    const { targetUserId, action, healthAmount } = req.body;
    const amount = parseInt(healthAmount);

    if (isNaN(amount) || amount < 0) return res.status(400).json({ message: 'Invalid health amount' });

    try {
        const target = await User.findOne({
            $or: [{ discordId: targetUserId }, { username: targetUserId }]
        });

        if (!target) return res.status(404).json({ message: 'User not found' });

        if (action === 'add') {
            target.health = Math.min(target.health + amount, target.maxHealth);
        } else if (action === 'sub') {
            target.health = Math.max(0, target.health - amount);
        } else {
            target.health = Math.min(amount, target.maxHealth);
        }

        await target.save();

        res.json({
            message: `Adjusted ${target.username}'s health to ${target.health}/${target.maxHealth}`,
            newHealth: target.health
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get Server Boosters
router.get('/boosters', async (req, res) => {
    try {
        let boosterConfig = await Config.findOne({ key: 'server_boosters' });
        if (!boosterConfig) {
            boosterConfig = new Config({
                key: 'server_boosters',
                value: [
                    { rank: 1, title: 'Arcane Sovereign', name: '- ระบุชื่อ -', boosts: 0 },
                    { rank: 2, title: 'Mystic Conqueror', name: '- ระบุชื่อ -', boosts: 0 },
                    { rank: 3, title: 'Enchanted Vanguard', name: '- ระบุชื่อ -', boosts: 0 }
                ]
            });
            await boosterConfig.save();
        }
        res.json(boosterConfig.value);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update Server Boosters (Admin only)
router.post('/boosters', isAuthenticated, hasRole(['admin', 'professor']), sanitizeBody, async (req, res) => {
    try {
        const { boosters } = req.body;
        if (!Array.isArray(boosters) || boosters.length !== 3) {
            return res.status(400).json({ message: 'Invalid boosters data layout.' });
        }

        let config = await Config.findOne({ key: 'server_boosters' });
        if (!config) {
            config = new Config({ key: 'server_boosters', value: boosters });
        } else {
            config.value = boosters;
        }

        // Use markModified because value is Mixed type
        config.markModified('value');
        await config.save();

        res.json({ message: 'Boosters configuration updated successfully.', boosters: config.value });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get Faculty Members
// L7 fix: No longer performs a DB write on every GET (write-on-read removed).
// Write only on first-time init when no config document exists yet.
const DEFAULT_FACULTY = [
    { name: 'Prof. Richard Moore', subject: 'Aweth', image: 'assets/images/Prof/Prof.Richard.png' },
    { name: 'Prof. Mathal', subject: 'Charms', image: 'assets/images/Prof/Prof.Mathal.png' },
    { name: 'Prof. King Zadkiel Winchester', subject: 'Faculty Member', image: 'assets/images/Prof/Prof.King.png' },
    { name: 'Prof. Navin White Rosier', subject: 'Astronomy', image: 'assets/images/Prof/Prof. Navin White Rosier.png' },
    { name: 'Prof. Tulphat Narintrapakdee', subject: 'Faculty Member', image: 'assets/images/Prof/Prof. Tulphat Narintrapakdee.png' },
    { name: 'Prof. Sofia McQueen', subject: 'Herblology', image: 'assets/images/Prof/Prof. Sofia McQueen.png' },
    { name: 'Prof. ScarDKillz', subject: 'Faculty Member', image: 'assets/images/Prof/Prof. ScarDKillz.png' },
    { name: 'Sir. Ngong Ngaeng', subject: 'Faculty Member', image: 'assets/images/Prof/Sir. Ngong Ngaeng.png' },
    { name: 'Prof. Mary Greengrass', subject: 'Faculty Member', image: 'assets/images/Prof/Prof.Mary Greengrass.png' }
];

router.get('/faculty', async (req, res) => {
    try {
        const facultyConfig = await Config.findOne({ key: 'faculty_members' }).lean();

        if (!facultyConfig) {
            // First-time init only — write default list to DB once
            const newConfig = new Config({ key: 'faculty_members', value: DEFAULT_FACULTY });
            await newConfig.save();
            return res.json(DEFAULT_FACULTY);
        }

        // Config exists — serve from DB, no write needed
        res.json(facultyConfig.value);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update Faculty Members (Admin only)
router.post('/faculty', isAuthenticated, hasRole(['admin', 'professor']), sanitizeBody, async (req, res) => {
    try {
        const { faculty } = req.body;
        if (!Array.isArray(faculty)) {
            return res.status(400).json({ message: 'Invalid faculty data layout.' });
        }

        let config = await Config.findOne({ key: 'faculty_members' });
        if (!config) {
            config = new Config({ key: 'faculty_members', value: faculty });
        } else {
            config.value = faculty;
        }

        config.markModified('value');
        await config.save();

        res.json({ message: 'Faculty configuration updated successfully.', faculty: config.value });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin: Detain User
router.post('/admin/detain', isAuthenticated, hasRole(['admin', 'professor']), sanitizeBody, async (req, res) => {
    try {
        const { targetUserId, minutes, reason } = req.body;
        const mins = parseInt(minutes);

        if (!targetUserId || isNaN(mins) || mins <= 0) {
            return res.status(400).json({ message: 'Invalid target or duration.' });
        }

        const target = await User.findOne({
            $or: [{ discordId: targetUserId }, { username: targetUserId }]
        });

        if (!target) return res.status(404).json({ message: 'User not found' });

        // Calculate end date
        const endDate = new Date(Date.now() + mins * 60000);

        target.isDetained = true;
        target.detentionEndDate = endDate;
        target.detentionReason = reason || 'Violation of school rules';

        await target.save();

        res.json({
            message: `${target.username} has been sent to detention for ${mins} minutes.`,
            detentionEndDate: endDate
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
