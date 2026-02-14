const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const Item = require('../models/Item');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// Get all recipes (populated with item details)
router.get('/recipes', async (req, res) => {
    try {
        const recipes = await Recipe.find().populate('resultItemId').populate('ingredients.itemId');
        res.json(recipes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add new recipe (Admin only)
router.post('/recipes/add', isAuthenticated, hasRole(['admin', 'professor']), async (req, res) => {
    const { resultItemId, ingredients, craftingType, craftingTime, requiredLevel } = req.body;

    try {
        const recipe = new Recipe({
            resultItemId,
            ingredients,
            craftingType: craftingType || 'cauldron',
            craftingTime: craftingTime || 0,
            requiredLevel: requiredLevel || 1
        });

        const saved = await recipe.save();
        const populated = await Recipe.findById(saved._id).populate('resultItemId').populate('ingredients.itemId');
        res.json(populated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete recipe (Admin only)
router.delete('/recipes/:id', isAuthenticated, hasRole(['admin', 'professor']), async (req, res) => {
    try {
        await Recipe.findByIdAndDelete(req.params.id);
        res.json({ message: 'Recipe removed.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Craft Item
router.post('/craft', isAuthenticated, async (req, res) => {
    const { recipeId } = req.body;

    try {
        const recipe = await Recipe.findById(recipeId).populate('ingredients.itemId');
        if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

        const user = await User.findById(req.user.id);

        // Check ingredients
        for (const ingredient of recipe.ingredients) {
            const userItem = user.inventory.find(i => i.itemId.toString() === ingredient.itemId._id.toString());
            if (!userItem || userItem.quantity < ingredient.quantity) {
                const name = ingredient.itemId.name || ingredient.itemId._id;
                return res.status(400).json({ message: `Missing ingredient: ${name}` });
            }
        }

        // Deduct ingredients
        for (const ingredient of recipe.ingredients) {
            const userItem = user.inventory.find(i => i.itemId.toString() === ingredient.itemId._id.toString());
            userItem.quantity -= ingredient.quantity;
            if (userItem.quantity <= 0) {
                user.inventory = user.inventory.filter(i => i.itemId.toString() !== ingredient.itemId._id.toString());
            }
        }

        // Add result item
        const resultId = recipe.resultItemId._id ? recipe.resultItemId._id.toString() : recipe.resultItemId.toString();
        const resultItemIndex = user.inventory.findIndex(i => i.itemId.toString() === resultId);
        if (resultItemIndex > -1) {
            user.inventory[resultItemIndex].quantity += 1;
        } else {
            user.inventory.push({ itemId: resultId, quantity: 1 });
        }

        await user.save();

        const resultItem = await Item.findById(resultId);
        res.json({
            message: `Successfully crafted ${resultItem ? resultItem.name : 'item'}!`,
            resultItemName: resultItem ? resultItem.name : 'Unknown',
            inventory: user.inventory
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
