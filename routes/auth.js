const express = require('express');
const passport = require('passport');
const router = express.Router();

// Redirect to Discord login
router.get('/discord', passport.authenticate('discord'));

// Discord callback URL
router.get('/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/dashboard');
});

router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return res.redirect('/'); }
        res.redirect('/');
    });
});

// Get current user info
router.get('/me', async (req, res) => {
    if (req.isAuthenticated()) {
        // Populate inventory items for the frontend
        const User = require('../models/User');
        try {
            const user = await User.findById(req.user.id).populate('inventory.itemId');
            res.json({
                authenticated: true,
                user: {
                    discordId: user.discordId,
                    username: user.username,
                    avatar: user.avatar,
                    roles: user.roles,
                    balance: user.balance,
                    house: user.house,
                    inventory: user.inventory
                }
            });
        } catch (err) {
            res.json({
                authenticated: true,
                user: {
                    discordId: req.user.discordId,
                    username: req.user.username,
                    avatar: req.user.avatar,
                    roles: req.user.roles,
                    balance: req.user.balance,
                    house: req.user.house,
                    inventory: req.user.inventory || []
                }
            });
        }
    } else {
        res.json({ authenticated: false });
    }
});

module.exports = router;
