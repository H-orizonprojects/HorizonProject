/**
 * @layer L7 — Application
 * Shop routes with L6 CacheManager integration.
 *
 * GET /items      — served from cache (60 s TTL), DB hit only on miss
 * POST /add       — invalidates cache after write
 * PUT  /:id       — invalidates cache after write
 * DELETE /:id     — invalidates cache after write
 */

'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Item = require('../models/Item');
const User = require('../models/User');
const { isAuthenticated, hasRole, isNotDetained } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

// L6: CacheManager singleton — in-memory TTL cache
const cache = require('../utils/cache');
const SHOP_ITEMS_KEY = 'shop_items';       // Base cache key
const SHOP_CACHE_TTL = 60 * 1000;          // 60 seconds

// ── Multer: memory storage for Base64 upload ─────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: (req, file, cb) => {
        const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// ── GET /items ────────────────────────────────────────────────────────────────
// L6: Check cache first. Build a per-type cache key so filtered and unfiltered
//     results are cached independently.
router.get('/items', async (req, res) => {
    try {
        const typeFilter = req.query.type || 'all';
        const cacheKey = `${SHOP_ITEMS_KEY}:${typeFilter}`;

        // L6: Cache hit — return immediately without touching MongoDB
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // L6: Cache miss — query DB then populate cache
        const filter = {};
        if (req.query.type) filter.type = req.query.type;

        const items = await Item.find(filter).lean(); // lean() = plain JS objects, faster serialization
        cache.set(cacheKey, items, SHOP_CACHE_TTL);

        res.json(items);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── POST /buy ─────────────────────────────────────────────────────────────────
router.post('/buy', isAuthenticated, isNotDetained, sanitizeBody, async (req, res) => {
    const { itemId, quantity } = req.body;

    try {
        const item = await Item.findById(itemId);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        const user = await User.findById(req.user.id);
        let unitPrice = item.price;
        let bonusMessages = [];

        // ── Divination buff: shop_discount (10% off) & bad omens (+10% price) ──────────
        if (user.dailyDivination && user.dailyDivination.expiryDate && new Date() < new Date(user.dailyDivination.expiryDate)) {
            if (user.dailyDivination.buffType === 'shop_discount') {
                unitPrice = Math.floor(unitPrice * 0.9);
                bonusMessages.push('🔮 Divination discount applied (-10%)');
            } else if (user.dailyDivination.buffType === 'omen_broken' || user.dailyDivination.buffType === 'omen_devil') {
                unitPrice = Math.ceil(unitPrice * 1.1);
                bonusMessages.push('👿 Omen penalty applied (+10% cost)');
            }
        }

        const totalCost = unitPrice * quantity;

        if (user.balance < totalCost) {
            return res.status(400).json({ message: 'Insufficient funds' });
        }

        user.balance -= totalCost;

        let finalQuantity = quantity;

        // ── Active pet buff: Owl shop_bonus_chance (10% free item) ───────────
        if (user.activePetId) {
            const activePet = user.pets.find(p => p._id.toString() === user.activePetId.toString());
            if (activePet) {
                const bonusBuff = activePet.buffs.find(b => b.target === 'shop_bonus_chance');
                if (bonusBuff && Math.random() * 100 < bonusBuff.value) {
                    finalQuantity += 1;
                    bonusMessages.push(`🦉 ${activePet.name} brought you an extra ${item.name} as a gift!`);
                }
            }
        }

        const existingItemIndex = user.inventory.findIndex(i => i.itemId.toString() === itemId);
        if (existingItemIndex > -1) {
            user.inventory[existingItemIndex].quantity += finalQuantity;
        } else {
            user.inventory.push({ itemId, quantity: finalQuantity });
        }

        user.markModified('inventory');
        await user.save();

        // ✅ ส่ง mailbox message เมื่อซื้อ equipment (ถ้า admin ได้กำหนดข้อความไว้)
        if (item.type === 'equipment' && item.mailboxMessage) {
            const Gift = require('../models/Gift');
            const letter = new Gift({
                senderId: user._id,
                senderName: 'Rachata School of Wizardry',
                recipientId: user._id,
                recipientName: user.username,
                itemId: item._id,
                quantity: 0,
                message: item.mailboxMessage,
                isClaimed: false
            });
            await letter.save();
        }

        const { updateQuestProgress } = require('../utils/quest');
        await updateQuestProgress(user._id, 'buy_item');

        const msg = bonusMessages.length > 0
            ? `Purchase successful! ${bonusMessages.join(' ')}`
            : 'Purchase successful';

        res.json({ message: msg, balance: user.balance, inventory: user.inventory, bonusMessages });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── POST /use ─────────────────────────────────────────────────────────────────
router.post('/use', isAuthenticated, isNotDetained, sanitizeBody, async (req, res) => {
    const { itemId, targetUsername } = req.body;

    try {
        const user = await User.findById(req.user.id);
        const slot = user.inventory.find(i => i.itemId.toString() === itemId);

        if (!slot || slot.quantity <= 0) {
            return res.status(400).json({ message: 'Item not in inventory' });
        }

        const item = await Item.findById(itemId);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        let healAmount = 0;
        let healthMsg = '';

        const isPetFood = item.name.toLowerCase().includes('feed') || item.name.toLowerCase().includes('อาหารสัตว์') || (item.description && item.description.includes('สัตว์'));
        if (isPetFood) {
            return res.status(400).json({ message: 'This item is meant for familiars! You cannot consume it.' });
        }

        if (item.name === 'Amortentia Potion') {
            if (!targetUsername) return res.status(400).json({ message: 'Target username is required for Love Potion!' });

            const target = await User.findOne({ username: targetUsername });
            if (!target) return res.status(404).json({ message: 'Target user not found' });

            const isAdmin = target.roles && (target.roles.includes('admin') || target.roles.includes('professor'));

            slot.quantity -= 1;
            if (slot.quantity <= 0) {
                user.inventory = user.inventory.filter(i => i.itemId.toString() !== itemId);
            }
            user.markModified('inventory');
            await user.save();

            if (!isAdmin) {
                target.activeEffects = target.activeEffects || [];
                target.activeEffects = target.activeEffects.filter(e => e.effectId !== 'love_potion');

                target.activeEffects.push({
                    effectId: 'love_potion',
                    casterId: user._id,
                    casterName: user.username,
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hr
                });

                target.markModified('activeEffects');
                await target.save();

                const Gift = require('../models/Gift');
                const gift = new Gift({
                    senderId: user._id,
                    senderName: 'System',
                    recipientId: target._id,
                    recipientName: target.username,
                    itemId: item._id,
                    quantity: 0,
                    message: `คุณถูกใช้คาถา Amortentia Potion (น้ำยาลุ่มหลง) เป็นเวลา 1 ชั่วโมง! การกระทำถัดไปในธนาคารหรือการส่งของของคุณอาจถูกครอบงำ...`,
                    isClaimed: false
                });
                await gift.save();

                return res.json({
                    message: `Love potion successfully cast on ${target.username}!`,
                    itemName: item.name,
                    inventory: user.inventory
                });
            } else {
                return res.json({
                    message: `You consumed the potion, but ${target.username} is immune!`,
                    itemName: item.name,
                    inventory: user.inventory
                });
            }
        }

        slot.quantity -= 1;
        if (slot.quantity <= 0) {
            user.inventory = user.inventory.filter(i => i.itemId.toString() !== itemId);
        }

        if (item.name === 'ชาอัญชัน') healAmount = 10;
        else if (item.name === 'ต้มยำ') healAmount = 50;
        else if (item.type === 'food') healAmount = 25;

        if (healAmount > 0) {
            user.health = Math.min(user.maxHealth, user.health + healAmount);
            healthMsg = ` (Restored +${healAmount} HP)`;
        }

        user.markModified('inventory');
        await user.save();

        res.json({
            message: `Consumed ${item ? item.name : 'item'} successfully${healthMsg}`,
            itemName: item ? item.name : 'Unknown',
            newHealth: user.health,
            inventory: user.inventory
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── POST /upload — Image upload (Admin only, returns Base64 URL) ──────────────
router.post('/upload', isAuthenticated, hasRole(['admin', 'professor']), upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

    // Convert buffer to Base64 string
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    res.json({ imageUrl: base64Image });
});

// ── POST /add — Add item (Admin only) ────────────────────────────────────────
// L6: Invalidates all shop_items cache entries after write
router.post('/add', isAuthenticated, hasRole(['admin', 'professor']), sanitizeBody, async (req, res) => {
    const { name, type, price, image, rarity, effects, description, mailboxMessage } = req.body;

    // Check for existing item with the same name
    const existingItem = await Item.findOne({ name });
    if (existingItem) {
        return res.status(400).json({ message: 'Item with this name already exists in the shop!' });
    }

    const newItem = new Item({
        name,
        description,
        type,
        price,
        image: image || '/assets/images/item.png',
        rarity: rarity || 'common',
        effects
    });

    try {
        const savedItem = await newItem.save();

        // L6: Invalidate cache — new item means cached lists are stale
        cache.flush();

        res.json(savedItem);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ── PUT /:id — Edit item (Admin only) ────────────────────────────────────────
// L6: Invalidates cache after update
router.put('/:id', isAuthenticated, hasRole(['admin', 'professor']), sanitizeBody, async (req, res) => {
    try {
        const updated = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ message: 'Item not found' });

        // L6: Invalidate cache — item data changed
        cache.flush();

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── DELETE /:id — Remove item (Admin only) ───────────────────────────────────
// L6: Invalidates cache after delete
router.delete('/:id', isAuthenticated, hasRole(['admin', 'professor']), async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);

        // L6: Invalidate cache — item removed from DB
        cache.flush();

        res.json({ message: 'Item removed from archives.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
