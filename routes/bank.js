const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');

// Get User Balance
router.get('/balance', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ balance: user.balance });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Transfer Funds
router.post('/transfer', isAuthenticated, async (req, res) => {
    const { recipientId, amount } = req.body; // recipientId can be discordId or username

    if (amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

    try {
        const sender = await User.findById(req.user.id);
        const recipient = await User.findOne({ discordId: recipientId });

        if (!recipient) return res.status(404).json({ message: 'Recipient not found' });
        if (sender.balance < amount) return res.status(400).json({ message: 'Insufficient funds' });

        sender.balance -= amount;
        recipient.balance += parseInt(amount);

        await sender.save();
        await recipient.save();

        res.json({ message: 'Transfer successful', newBalance: sender.balance });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
