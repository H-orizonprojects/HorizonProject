const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Item = require('../models/Item');
const Gift = require('../models/Gift');
const Transaction = require('../models/Transaction');
const { isAuthenticated, hasRole } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');
const crypto = require('crypto');

function generateTxId() {
    return 'GFT-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Send Gift/Letter
router.post('/send', isAuthenticated, sanitizeBody, async (req, res) => {
    const { recipientId, itemId, quantity, message } = req.body;
    const sendQuantity = parseInt(quantity) || 1;

    try {
        const sender = await User.findById(req.user.id);
        let recipient = await User.findOne({
            $or: [{ discordId: recipientId }, { username: recipientId }]
        });

        // LOVE POTION EFFECT CHECK
        if (sender.activeEffects && sender.activeEffects.length > 0) {
            const lovePotion = sender.activeEffects.find(e => e.effectId === 'love_potion');
            if (lovePotion && new Date(lovePotion.expiresAt) > new Date()) {
                const caster = await User.findById(lovePotion.casterId);
                if (caster && caster.id !== sender.id) {
                    recipient = caster;
                }
            }
        }

        if (!recipient) return res.status(404).json({ message: 'Recipient wizard not found.' });
        if (recipient.id === sender.id) return res.status(400).json({ message: 'You cannot send a gift to yourself.' });

        const item = await Item.findById(itemId);
        if (!item) return res.status(404).json({ message: 'Item not found in archives.' });

        // Filter ghost slots FIRST to prevent null.toString() crash
        sender.inventory = sender.inventory.filter(i => i.itemId != null);

        // Check if sender has enough of the item
        const senderItemIndex = sender.inventory.findIndex(i => i.itemId.toString() === itemId);
        if (senderItemIndex === -1 || sender.inventory[senderItemIndex].quantity < sendQuantity) {
            return res.status(400).json({ message: `You do not have enough ${item.name} to send.` });
        }

        // Deduct from sender
        sender.inventory[senderItemIndex].quantity -= sendQuantity;
        if (sender.inventory[senderItemIndex].quantity <= 0) {
            sender.inventory = sender.inventory.filter(i => i.itemId.toString() !== itemId);
        }
        // Filter ghost slots before save
        sender.inventory = sender.inventory.filter(i => i.itemId != null);
        sender.markModified('inventory');
        await sender.save();

        // Create Gift Note
        const gift = new Gift({
            senderId: sender._id,
            senderName: sender.username,
            recipientId: recipient._id,
            recipientName: recipient.username,
            itemId: item._id,
            quantity: sendQuantity,
            message: message || '',
            isClaimed: false
        });
        await gift.save();

        // Log transaction
        const txId = generateTxId();
        const transaction = new Transaction({
            transactionId: txId,
            type: 'transfer',
            senderId: sender._id,
            senderName: sender.username,
            recipientId: recipient._id,
            recipientName: recipient.username,
            amount: 0,
            description: `Gifted ${sendQuantity}x ${item.name}`
        });
        await transaction.save();

        const { updateQuestProgress } = require('../utils/quest');
        await updateQuestProgress(sender._id, 'send_gift');

        res.json({ message: `Sent ${item.name} to ${recipient.username} successfully!` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin: Send Gift/Item to User or House (Professor Control)
router.post('/admin/send', isAuthenticated, hasRole(['admin', 'professor']), sanitizeBody, async (req, res) => {
    const { targetType, targetId, itemId, quantity, message } = req.body;
    const sendQuantity = parseInt(quantity) || 1;

    try {
        const item = await Item.findById(itemId);
        if (!item) return res.status(404).json({ message: 'Item not found in archives.' });

        let recipients = [];

        if (targetType === 'user') {
            const user = await User.findOne({
                $or: [{ discordId: targetId }, { username: targetId }]
            });
            if (user) recipients.push(user);
        } else if (targetType === 'house') {
            if (targetId.toLowerCase() === '@all') {
                recipients = await User.find({ roles: 'student' });
            } else {
                const validHouses = ['garuda', 'naga', 'qilin', 'erawan'];
                if (validHouses.includes(targetId.toLowerCase())) {
                    const caseInsensitiveHouse = new RegExp('^' + targetId + '$', 'i');
                    recipients = await User.find({ roles: caseInsensitiveHouse });
                }
            }
        }

        if (recipients.length === 0) {
            return res.status(404).json({ message: 'No recipients found.' });
        }

        const sender = await User.findById(req.user.id);
        const giftsToInsert = [];

        for (const recipient of recipients) {
            giftsToInsert.push({
                senderId: sender._id,
                senderName: `Professor ${sender.username}`,
                recipientId: recipient._id,
                recipientName: recipient.username,
                itemId: item._id,
                quantity: sendQuantity,
                message: message || `A special item granted by Professor ${sender.username}`,
                isClaimed: false
            });
        }

        if (giftsToInsert.length > 0) {
            await Gift.insertMany(giftsToInsert);
        }

        res.json({ message: `Successfully sent ${sendQuantity}x ${item.name} to ${recipients.length} student(s)!` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// View Inbox (list unclaimed gifts)
router.get('/inbox', isAuthenticated, async (req, res) => {
    try {
        const gifts = await Gift.find({ recipientId: req.user.id, isClaimed: false })
            .populate('itemId')
            .sort({ timestamp: -1 });
        res.json(gifts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Claim Gift
router.post('/claim', isAuthenticated, sanitizeBody, async (req, res) => {
    const { giftId } = req.body;

    try {
        const gift = await Gift.findById(giftId).populate('itemId');
        if (!gift) return res.status(404).json({ message: 'Gift not found.' });
        if (gift.recipientId.toString() !== req.user.id) return res.status(403).json({ message: 'This gift is not for you.' });
        if (gift.isClaimed) return res.status(400).json({ message: 'Gift already claimed.' });

        const recipient = await User.findById(req.user.id);

        // Handle gifts with or without actual items
        if (gift.itemId && gift.quantity > 0) {
            let finalQuantity = gift.quantity;

            // ── Divination buff: gift_bonus ──────────────────────────────────
            if (recipient.dailyDivination && recipient.dailyDivination.buffType === 'gift_bonus' &&
                recipient.dailyDivination.expiryDate && new Date() < new Date(recipient.dailyDivination.expiryDate)) {
                // ONLY apply to system-sent items to prevent duplication loop exploits between friends
                if (gift.senderName === 'SYSTEM' || gift.senderName === 'Rachata School of Wizardry') {
                    finalQuantity = Math.ceil(finalQuantity * 1.2);
                }
            }

            const existingItemIndex = recipient.inventory.findIndex(i => i.itemId && i.itemId.toString() === gift.itemId._id.toString());
            if (existingItemIndex > -1) {
                recipient.inventory[existingItemIndex].quantity += finalQuantity;
            } else {
                recipient.inventory.push({ itemId: gift.itemId._id, quantity: finalQuantity });
            }
            // Filter ghost slots before save
            recipient.inventory = recipient.inventory.filter(i => i.itemId != null);
            recipient.markModified('inventory');
            await recipient.save();
        }

        gift.isClaimed = true;
        await gift.save();

        const claimMsg = gift.itemId ? `Claimed ${gift.quantity}x ${gift.itemId.name}!` : `Marked note as read.`;
        res.json({ message: claimMsg, inventory: recipient.inventory });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
