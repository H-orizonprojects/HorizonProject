const express = require('express');
const passport = require('passport');
const router = express.Router();

// Redirect to Discord login
router.get('/discord', passport.authenticate('discord'));

// Discord callback URL
router.get('/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    // Successful authentication, redirect to dashboard or home
    res.redirect('/dashboard.html'); // Assuming creating a dashboard page
});

// Logout
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

// Get current user info - Important for frontend to check login status
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                username: req.user.username,
                avatar: req.user.avatar,
                roles: req.user.roles,
                balance: req.user.balance,
                house: req.user.house
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

module.exports = router;
