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

        user.balance -= totalCost;

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

// Use/Consume item from inventory
router.post('/use', isAuthenticated, async (req, res) => {
    const { itemId } = req.body;

    try {
        const user = await User.findById(req.user.id);
        const slot = user.inventory.find(i => i.itemId.toString() === itemId);

        if (!slot || slot.quantity <= 0) {
            return res.status(400).json({ message: 'Item not in inventory' });
        }

        slot.quantity -= 1;
        if (slot.quantity <= 0) {
            user.inventory = user.inventory.filter(i => i.itemId.toString() !== itemId);
        }

        await user.save();

        const item = await Item.findById(itemId);
        res.json({
            message: `Used ${item ? item.name : 'item'} successfully`,
            itemName: item ? item.name : 'Unknown',
            inventory: user.inventory
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add item (Admin only)
router.post('/add', isAuthenticated, hasRole(['admin', 'professor']), async (req, res) => {
    const { name, type, price, image, rarity, effects, description } = req.body;

    const newItem = new Item({
        name,
        description,
        type,
        price,
        image,
        rarity: rarity || 'common',
        effects
    });

    try {
        const savedItem = await newItem.save();
        res.json(savedItem);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Edit item (Admin only)
router.put('/:id', isAuthenticated, hasRole(['admin', 'professor']), async (req, res) => {
    try {
        const updated = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ message: 'Item not found' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete item (Admin only)
router.delete('/:id', isAuthenticated, hasRole(['admin', 'professor']), async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        res.json({ message: 'Item removed from archives.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
