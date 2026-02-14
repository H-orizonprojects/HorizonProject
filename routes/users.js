const express = require('express');
const router = express.Router();
const User = require('../models/User');

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
        }).select('discordId username avatar balance roles house').sort({ username: 1 });

        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all users (admin only)
const { isAuthenticated, hasRole } = require('../middleware/auth');

router.get('/all', isAuthenticated, hasRole(['admin', 'professor']), async (req, res) => {
    try {
        const users = await User.find().select('discordId username avatar balance roles house').sort({ username: 1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
