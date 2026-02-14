const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { isAuthenticated, hasRole } = require('../middleware/auth');
const crypto = require('crypto');

function generateTxId() {
    return 'GRN-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Get User Balance
router.get('/balance', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ balance: user.balance });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get Transaction History
router.get('/transactions', isAuthenticated, async (req, res) => {
    try {
        const transactions = await Transaction.find({
            $or: [{ senderId: req.user.id }, { recipientId: req.user.id }]
        }).sort({ timestamp: -1 }).limit(50);
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Transfer Funds
router.post('/transfer', isAuthenticated, async (req, res) => {
    const { recipientId, amount } = req.body;
    const transferAmount = parseInt(amount);

    if (!transferAmount || transferAmount <= 0) return res.status(400).json({ message: 'Invalid amount' });

    try {
        const sender = await User.findById(req.user.id);
        // Search by discordId or username
        const recipient = await User.findOne({
            $or: [{ discordId: recipientId }, { username: recipientId }]
        });

        if (!recipient) return res.status(404).json({ message: 'Recipient not found' });
        if (recipient.id === sender.id) return res.status(400).json({ message: 'Cannot transfer to yourself' });
        if (sender.balance < transferAmount) return res.status(400).json({ message: 'Insufficient funds' });

        sender.balance -= transferAmount;
        recipient.balance += transferAmount;

        await sender.save();
        await recipient.save();

        // Save transaction
        const txId = generateTxId();
        const transaction = new Transaction({
            transactionId: txId,
            type: 'transfer',
            senderId: sender._id,
            senderName: sender.username,
            recipientId: recipient._id,
            recipientName: recipient.username,
            amount: transferAmount,
            description: `Transfer from ${sender.username} to ${recipient.username}`
        });
        await transaction.save();

        res.json({
            message: 'Transfer successful',
            newBalance: sender.balance,
            transaction: {
                transactionId: txId,
                senderName: sender.username,
                recipientName: recipient.username,
                amount: transferAmount,
                timestamp: transaction.timestamp
            }
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin: Adjust user balance (add/subtract gold)
router.post('/admin/adjust', isAuthenticated, hasRole(['admin', 'professor']), async (req, res) => {
    const { targetUserId, amount, reason } = req.body;
    const adjustAmount = parseInt(amount);

    if (!adjustAmount) return res.status(400).json({ message: 'Invalid amount' });

    try {
        const target = await User.findOne({
            $or: [{ discordId: targetUserId }, { username: targetUserId }]
        });

        if (!target) return res.status(404).json({ message: 'User not found' });

        target.balance += adjustAmount;
        if (target.balance < 0) target.balance = 0;
        await target.save();

        // Log the admin action
        const txId = generateTxId();
        const transaction = new Transaction({
            transactionId: txId,
            type: 'admin_adjust',
            senderId: req.user.id,
            senderName: req.user.username,
            recipientId: target._id,
            recipientName: target.username,
            amount: adjustAmount,
            description: reason || `Admin adjustment by ${req.user.username}`
        });
        await transaction.save();

        res.json({
            message: `Adjusted ${target.username}'s balance by ${adjustAmount}G`,
            newBalance: target.balance,
            transactionId: txId
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
