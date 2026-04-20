const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const Item = require('../models/Item');
const { isAuthenticated, hasRole, isNotDetained } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

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
router.post('/recipes/add', isAuthenticated, hasRole(['admin', 'professor']), sanitizeBody, async (req, res) => {
    const { resultItemId, resultItemName, ingredients, craftingType, craftingTime, requiredLevel } = req.body;

    try {
        const recipeData = {
            ingredients,
            craftingType: craftingType || 'cauldron',
            craftingTime: craftingTime || 0,
            requiredLevel: requiredLevel || 1
        };

        // Support both: existing item ID or a custom free-form name
        if (resultItemId) {
            recipeData.resultItemId = resultItemId;
        }
        if (resultItemName) {
            recipeData.resultItemName = resultItemName;
        }

        const recipe = new Recipe(recipeData);
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
router.post('/craft', isAuthenticated, isNotDetained, sanitizeBody, async (req, res) => {
    const { recipeId } = req.body;

    try {
        if (recipeId === 'love_potion') {
            const user = await User.findById(req.user.id).populate({ path: 'inventory.itemId', model: 'Item' });
            if (!user) return res.status(404).json({ message: 'User not found' });

            const legendaryItems = user.inventory.filter(i => i.itemId && i.itemId.rarity === 'legendary');
            const rareItems = user.inventory.filter(i => i.itemId && i.itemId.rarity === 'rare');

            const totalLegendaryQty = legendaryItems.reduce((sum, item) => sum + item.quantity, 0);
            const totalRareQty = rareItems.reduce((sum, item) => sum + item.quantity, 0);

            if (totalLegendaryQty < 2 || totalRareQty < 2) {
                return res.status(400).json({ message: 'Missing ingredients: Need 2 Legendary and 2 Rare items.' });
            }

            let legNeeded = 2;
            for (const leg of legendaryItems) {
                if (legNeeded <= 0) break;
                const deduct = Math.min(leg.quantity, legNeeded);
                leg.quantity -= deduct;
                legNeeded -= deduct;
            }

            let rareNeeded = 2;
            for (const rare of rareItems) {
                if (rareNeeded <= 0) break;
                const deduct = Math.min(rare.quantity, rareNeeded);
                rare.quantity -= deduct;
                rareNeeded -= deduct;
            }

            user.inventory = user.inventory.filter(i => i.quantity > 0 && i.itemId != null);

            let potion = await Item.findOne({ name: 'Amortentia Potion' });
            if (!potion) {
                potion = new Item({
                    name: 'Amortentia Potion',
                    description: 'A powerful enchantment potion that binds the target\u2019s gold and gifts to you for 1 hour.',
                    type: 'potion',
                    rarity: 'epic',
                    price: 0,
                    image: 'assets/images/Amortentia.png'
                });
                await potion.save();
            } else if (potion.image === 'assets/images/Amortentia.png' || potion.image === 'assets/images/Amortentia.png') {
                potion.image = 'assets/images/Amortentia.png';
                await potion.save();
            }

            const potionIdStr = potion._id.toString();
            const existingIdx = user.inventory.findIndex(i => {
                if (!i.itemId) return false;
                const id = i.itemId._id ? i.itemId._id.toString() : i.itemId.toString();
                return id === potionIdStr;
            });
            if (existingIdx > -1) {
                user.inventory[existingIdx].quantity += 1;
            } else {
                user.inventory.push({ itemId: potion._id, quantity: 1 });
            }

            user.inventory = user.inventory
                .filter(i => i.itemId != null)
                .map(i => ({ itemId: i.itemId._id || i.itemId, quantity: i.quantity }));

            user.inventory = user.inventory.filter(i => i.itemId != null);
            user.markModified('inventory');
            await user.save();

            const { updateQuestProgress } = require('../utils/quest');
            await updateQuestProgress(user._id, 'craft_potion');

            return res.json({
                message: `Successfully crafted Amortentia Potion!`,
                resultItemName: 'Amortentia Potion',
                inventory: user.inventory
            });
        }

        const recipe = await Recipe.findById(recipeId).populate('resultItemId').populate('ingredients.itemId');
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

        let resultItemDisplayName = recipe.resultItemName || (recipe.resultItemId ? 'item' : 'Unknown');

        // ── Active pet buff: Kneazle craft_safety ──────────────────────────
        let craftSafetyBonus = 0;
        let craftSafetyMsg = '';
        if (user.activePetId) {
            const activePet = user.pets.find(p => p._id.toString() === user.activePetId.toString());
            if (activePet) {
                const safetyBuff = activePet.buffs.find(b => b.target === 'craft_safety');
                if (safetyBuff) {
                    craftSafetyBonus = safetyBuff.value; // e.g. 15
                    craftSafetyMsg = ` 🐱 ${activePet.name} ensured no cauldron explosions (+${craftSafetyBonus}% success)`;
                }
            }
        }

        // ── Divination buff/debuff: craft_bonus (+10/15%), omen_snake (-20%), omen_fool (-15%) ─────────────
        let omenPenalty = 0;
        let divinationBonus = 0;
        let divinationMsg = '';
        if (user.dailyDivination && user.dailyDivination.expiryDate && new Date() < new Date(user.dailyDivination.expiryDate)) {
            if (user.dailyDivination.buffType === 'omen_snake') {
                omenPenalty = 20;
                divinationMsg = ' 🐍 The Serpent\'s Hex made this harder.';
            } else if (user.dailyDivination.buffType === 'omen_fool') {
                omenPenalty = 15;
                divinationMsg = ' 🃏 The Fool\'s haste made this riskier.';
            } else if (user.dailyDivination.buffType === 'craft_bonus') {
                divinationBonus = user.dailyDivination.readingType === 'tarot' ? 15 : 10;
                divinationMsg = ` ✨ Divination favor increased success (+${divinationBonus}%)!`;
            }
        }

        // Apply recipe success rate with pet/omen modifiers
        if (recipe.successRate && recipe.successRate < 100) {
            const effectiveRate = Math.min(100, recipe.successRate + craftSafetyBonus + divinationBonus - omenPenalty);
            if (Math.random() * 100 > effectiveRate) {
                // Craft failed — still deduct ingredients, just no result
                user.inventory = user.inventory.filter(i => i.itemId != null);
                user.markModified('inventory');
                await user.save();
                const { updateQuestProgress } = require('../utils/quest');
                await updateQuestProgress(user._id, 'craft_potion');
                return res.status(200).json({
                    message: `The cauldron bubbles and smokes... ${resultItemDisplayName} failed to materialize. Better luck next time!${divinationMsg ? divinationMsg : ''}`,
                    resultItemName: null,
                    failed: true,
                    inventory: user.inventory
                });
            }
        }

        // Add result item to inventory only if it's a real shop item
        if (recipe.resultItemId) {
            const resultId = recipe.resultItemId._id
                ? recipe.resultItemId._id.toString()
                : recipe.resultItemId.toString();

            const resultItemIndex = user.inventory.findIndex(i => i.itemId.toString() === resultId);
            if (resultItemIndex > -1) {
                user.inventory[resultItemIndex].quantity += 1;
            } else {
                user.inventory.push({ itemId: resultId, quantity: 1 });
            }

            const resultItem = await Item.findById(resultId);
            resultItemDisplayName = resultItem ? resultItem.name : resultItemDisplayName;
        }

        user.inventory = user.inventory.filter(i => i.itemId != null);
        user.markModified('inventory');
        await user.save();

        const { updateQuestProgress } = require('../utils/quest');
        await updateQuestProgress(user._id, 'craft_potion');

        res.json({
            message: `Successfully crafted ${resultItemDisplayName}!${craftSafetyMsg}${divinationBonus > 0 ? divinationMsg : ''}`,
            resultItemName: resultItemDisplayName,
            inventory: user.inventory
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

