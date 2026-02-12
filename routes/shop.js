const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// Get all items
router.get('/items', async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Buy item
router.post('/buy', isAuthenticated, async (req, res) => {
    const { itemId, quantity } = req.body;

    try {
        const item = await Item.findById(itemId);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        const user = await User.findById(req.user.id);
        const totalCost = item.price * quantity;

        if (user.balance < totalCost) {
            return res.status(400).json({ message: 'Insufficient funds' });
        }

        // Deduct balance
        user.balance -= totalCost;

        // Add to inventory
        const existingItemIndex = user.inventory.findIndex(i => i.itemId.toString() === itemId);
        if (existingItemIndex > -1) {
            user.inventory[existingItemIndex].quantity += quantity;
        } else {
            user.inventory.push({ itemId, quantity });
        }

        await user.save();
        res.json({ message: 'Purchase successful', balance: user.balance, inventory: user.inventory });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add item (Admin only)
// Assuming 'admin' role check or specific user check
router.post('/add', isAuthenticated, async (req, res) => {
    // Add admin check here or use middleware
    const { name, type, price, image, rarity, effects } = req.body;

    const newItem = new Item({
        name,
        type,
        price,
        image,
        rarity,
        effects
    });

    try {
        const savedItem = await newItem.save();
        res.json(savedItem);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
