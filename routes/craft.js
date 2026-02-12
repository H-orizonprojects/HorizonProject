const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const Item = require('../models/Item');
const { isAuthenticated } = require('../middleware/auth');

// Get all recipes
router.get('/recipes', async (req, res) => {
    try {
        const recipes = await Recipe.find().populate('resultItemId').populate('ingredients.itemId');
        res.json(recipes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Craft Item
router.post('/craft', isAuthenticated, async (req, res) => {
    const { recipeId } = req.body;

    try {
        const recipe = await Recipe.findById(recipeId);
        if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

        const user = await User.findById(req.user.id);

        // Check ingredients
        for (const ingredient of recipe.ingredients) {
            const userItem = user.inventory.find(i => i.itemId.toString() === ingredient.itemId.toString());
            if (!userItem || userItem.quantity < ingredient.quantity) {
                return res.status(400).json({ message: `Missing ingredient: ${ingredient.itemId}` }); // Should return name ideally
            }
        }

        // Deduct ingredients
        for (const ingredient of recipe.ingredients) {
            const userItem = user.inventory.find(i => i.itemId.toString() === ingredient.itemId.toString());
            userItem.quantity -= ingredient.quantity;
            // Remove item if quantity is 0? Optional logic
            if (userItem.quantity <= 0) {
                user.inventory = user.inventory.filter(i => i.itemId.toString() !== ingredient.itemId.toString());
            }
        }

        // Add result item
        const resultItemIndex = user.inventory.findIndex(i => i.itemId.toString() === recipe.resultItemId.toString());
        if (resultItemIndex > -1) {
            user.inventory[resultItemIndex].quantity += 1;
        } else {
            user.inventory.push({ itemId: recipe.resultItemId, quantity: 1 });
        }

        await user.save();
        res.json({ message: 'Crafting successful', inventory: user.inventory });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
