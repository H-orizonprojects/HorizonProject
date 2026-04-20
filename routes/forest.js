// routes/forest.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Item = require('../models/Item');
const { isAuthenticated, isNotDetained } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

// Seed to randomize forest opening times daily
// We will generate a daily seed based on the current date, ensuring it changes every day
function getDailyForestWindow() {
    const now = new Date();
    // Use Thailand time for calculation
    const thTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    
    // Create a deterministic seed based on date string "YYYY-MM-DD"
    const dateStr = `${thTime.getUTCFullYear()}-${thTime.getUTCMonth()}-${thTime.getUTCDate()}`;
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = Math.imul(31, hash) + dateStr.charCodeAt(i) | 0;
    }
    
    // Convert hash to an hour between 0 and 23
    const startHour = Math.abs(hash) % 24;
    return { startHour, endHour: (startHour + 1) % 24 }; // Open for 1 hour
}

const Config = require('../models/Config');
const Gift = require('../models/Gift');

router.get('/status', isAuthenticated, async (req, res) => {
    const window = getDailyForestWindow();
    const now = new Date();
    const thTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const thHour = thTime.getUTCHours();
    const dateStr = `${thTime.getUTCFullYear()}-${thTime.getUTCMonth()}-${thTime.getUTCDate()}`;
    
    const user = await User.findById(req.user.id);
    const isAdmin = user.roles && (user.roles.includes('admin') || user.roles.includes('professor'));
    
    const isActuallyOpen = (thHour === window.startHour || thHour === window.endHour);
    const isOpen = isAdmin || isActuallyOpen;
    
    // Auto-announce if currently open and hasn't been announced today
    if (isActuallyOpen) {
        try {
            let config = await Config.findOne({ key: 'forest_announcement_date' });
            if (!config || config.value !== dateStr) {
                // We need to announce!
                if (!config) config = new Config({ key: 'forest_announcement_date', value: dateStr });
                else config.value = dateStr;
                await config.save();

                // Send mail to all users asynchronously
                Item.findOne({ name: 'Parchment Letter' }).then(letterItem => {
                    User.find().select('_id username').then(allUsers => {
                        const gifts = allUsers.map(u => ({
                            senderId: user._id,
                            senderName: 'SYSTEM',
                            recipientId: u._id,
                            recipientName: u.username,
                            itemId: letterItem ? letterItem._id : null, 
                            quantity: 0,
                            message: '🌿 The Himmapan Forest is now open! It will only remain open for 1 hour. Hurry and explore!',
                            isClaimed: false
                        }));
                        Gift.insertMany(gifts).catch(console.error);
                    }).catch(console.error);
                }).catch(console.error);
            }
        } catch (e) {
            console.error('Failed to auto-announce forest:', e);
        }
    }
    
    let maxGathers = 1;
    if (user.dailyDivination && user.dailyDivination.buffType === 'extra_forest_entry' && (!user.dailyDivination.expiryDate || new Date(user.dailyDivination.expiryDate) > now)) {
        maxGathers = 2;
    }
    
    let gathersToday = user.forestGatherCount || 0;
    if (user.lastForestGatherDate) {
        const lastGather = new Date(user.lastForestGatherDate);
        const thLastGather = new Date(lastGather.getTime() + (7 * 60 * 60 * 1000));
        if (
            thLastGather.getUTCFullYear() !== thTime.getUTCFullYear() ||
            thLastGather.getUTCMonth() !== thTime.getUTCMonth() ||
            thLastGather.getUTCDate() !== thTime.getUTCDate()
        ) {
            gathersToday = 0;
        }
    } else {
        gathersToday = 0;
    }

    res.json({
        isOpen,
        hint: `The forest shifts around hour ${window.startHour}:00 TH Time.`,
        gathersToday,
        maxGathers
    });
});

router.post('/gather', isAuthenticated, isNotDetained, sanitizeBody, async (req, res) => {
    try {
        const window = getDailyForestWindow();
        const now = new Date();
        const thTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const thHour = thTime.getUTCHours();

        const user = await User.findById(req.user.id);
        const isAdmin = user.roles && (user.roles.includes('admin') || user.roles.includes('professor'));

        // 1. Is the forest open?
        if (!isAdmin && (thHour !== window.startHour && thHour !== window.endHour)) {
           return res.status(400).json({ message: 'The Himmapan Forest is currently closed. It only appears for 1 hour a day.' });
        }

        // 2. Has user gathered today? Count based on 00:00 TH Time
        let maxGathers = 1;
        if (user.dailyDivination && user.dailyDivination.buffType === 'extra_forest_entry' && (!user.dailyDivination.expiryDate || new Date(user.dailyDivination.expiryDate) > now)) {
            maxGathers = 2;
        }

        let gathersToday = user.forestGatherCount || 0;
        if (!isAdmin && user.lastForestGatherDate) {
            const lastGather = new Date(user.lastForestGatherDate);
            const thLastGather = new Date(lastGather.getTime() + (7 * 60 * 60 * 1000));
            
            if (
                thLastGather.getUTCFullYear() === thTime.getUTCFullYear() &&
                thLastGather.getUTCMonth() === thTime.getUTCMonth() &&
                thLastGather.getUTCDate() === thTime.getUTCDate()
            ) {
                if (gathersToday >= maxGathers) {
                    return res.status(400).json({ message: 'You have explored the maximum number of times today. Rest and return tomorrow.' });
                }
            } else {
                gathersToday = 0;
            }
        } else if (!isAdmin) {
            gathersToday = 0;
        }

        // Increment count and set date right before saving (done later in code)
        user.forestGatherCount = gathersToday + 1;
        user.lastForestGatherDate = now;


        // 3. Roll for rarity drop
        // Base Probabilities: Common 55%, Uncommon 25%, Rare 15%, Legendary 5%
        let rareBonus = 0;
        let legBonus = 0;

        if (user.activePetId) {
            const pet = user.pets.find(p => p._id.toString() === user.activePetId.toString());
            if (pet) {
                const dropBuff = pet.buffs.find(b => b.target === 'forest_drop_rate');
                if (dropBuff) {
                    rareBonus = dropBuff.value;
                    legBonus = Math.floor(dropBuff.value / 2);
                }
            }
        }

        let legThreshold = 5 + legBonus;
        let rareThreshold = 20 + rareBonus;
        let uncommonThreshold = 45 + Math.floor(rareBonus / 2);

        let dropPenalty = 0;
        if (user.dailyDivination && user.dailyDivination.expiryDate && new Date() < new Date(user.dailyDivination.expiryDate)) {
            if (user.dailyDivination.buffType === 'omen_storm' || user.dailyDivination.buffType === 'omen_moon') {
                dropPenalty = 15;
            }
        }

        legThreshold = Math.max(0, legThreshold - dropPenalty);
        rareThreshold = Math.max(0, rareThreshold - dropPenalty);
        uncommonThreshold = Math.max(0, uncommonThreshold - dropPenalty);

        const roll = Math.random() * 100;
        let selectedRarity = 'common';
        
        let epicThreshold = legThreshold + 3; // Epic sits just above legendary

        if (roll <= legThreshold) {
            selectedRarity = 'legendary';
        } else if (roll <= epicThreshold) {
            selectedRarity = 'epic';
        } else if (roll <= rareThreshold) {
            selectedRarity = 'rare';
        } else if (roll <= uncommonThreshold) {
            selectedRarity = 'uncommon';
        }

        // 4. Fetch random item of that rarity
        const potentialItems = await Item.find({ rarity: selectedRarity, type: 'material' });
        
        if (!potentialItems || potentialItems.length === 0) {
            return res.status(500).json({ message: 'No materials found in the database.' });
        }

        const randomItem = potentialItems[Math.floor(Math.random() * potentialItems.length)];

        // 5. Give to user
        const existingItemIndex = user.inventory.findIndex(i => i.itemId.toString() === randomItem._id.toString());
        const quantityGained = 1; // Or random amount?
        
        if (existingItemIndex > -1) {
            user.inventory[existingItemIndex].quantity += quantityGained;
        } else {
            user.inventory.push({ itemId: randomItem._id, quantity: quantityGained });
        }

        // Filter ghost slots before save
        user.inventory = user.inventory.filter(i => i.itemId != null);
        user.markModified('inventory');
        await user.save();

        const { updateQuestProgress } = require('../utils/quest');
        await updateQuestProgress(user._id, 'explore_himmapan');

        res.json({
            message: `You ventured into the Himmapan Forest and found: ${randomItem.name}!`,
            item: randomItem,
            rarity: selectedRarity
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
