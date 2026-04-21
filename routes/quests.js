const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const User = require('../models/User');
const Item = require('../models/Item');

const QUEST_TYPES = [
    { type: 'explore_himmapan', target: 2, label: 'เอาตัวรอดในป่าหิมพานต์ 2 ครั้ง', rng: () => ({ target: 1 + Math.floor(Math.random() * 2) }) },
    { type: 'craft_potion', target: 2, label: 'ปรุงยา 2 ขวด', rng: () => ({ target: 1 + Math.floor(Math.random() * 2) }) },
    { type: 'buy_item', target: 1, label: 'ซื้อไอเทมจากร้านค้า 1 ครั้ง', rng: () => ({ target: 1 }) },
    { type: 'send_gift', target: 1, label: 'ส่งของขวัญให้เพื่อน 1 ครั้ง', rng: () => ({ target: 1 }) }
];

function isNewQuestPeriod(date) {
    if (!date) return true;
    const now = new Date();
    
    // Determine the last 8:00 AM Thailand boundary before the target Date
    // Thai time = UTC+7, so 8:00 AM TH = 01:00 AM UTC.
    function getResetBoundary(dt) {
        const y = dt.getUTCFullYear();
        const mo = dt.getUTCMonth();
        const d = dt.getUTCDate();
        const h = dt.getUTCHours();
        
        let boundary = new Date(Date.UTC(y, mo, d, 1, 0, 0, 0));
        // If the current hour is before 01:00 UTC, the reset was yesterday at 01:00 UTC
        if (h < 1) {
            boundary = new Date(Date.UTC(y, mo, d - 1, 1, 0, 0, 0));
        }
        return boundary;
    }

    const nowBoundary = getResetBoundary(now);
    const lastBoundary = getResetBoundary(date);
    
    // It's a new period if the current time's boundary is greater than the date's boundary
    return nowBoundary.getTime() > lastBoundary.getTime();
}

function generateQuests() {
    // Shuffle and pick 3 unique quests
    const shuffled = QUEST_TYPES.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    
    return selected.map(q => {
        const specs = q.rng();
        const rewardType = Math.random() > 0.5 ? 'galleons' : 'material';
        // Enforce max 50 Galleons limit strictly: Math.floor(rng * 41) is [0, 40] -> + 10 = [10, 50]
        const rewardAmount = rewardType === 'galleons' ? Math.floor(10 + Math.random() * 41) : 1; 
        return {
            questType: q.type,
            target: specs.target,
            progress: 0,
            isCompleted: false,
            isClaimed: false,
            rewardType,
            rewardAmount: Math.min(rewardAmount, 50) // Absolute cap at 50
        };
    });
}

// Get quests or generate if new day
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (isNewQuestPeriod(user.lastQuestReset)) {
            user.dailyQuests = generateQuests();
            user.lastQuestReset = new Date();
            await user.save();
        }
        res.json({ quests: user.dailyQuests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Claim a completed quest
router.post('/claim', isAuthenticated, async (req, res) => {
    try {
        const { questId } = req.body; // _id of the quest subdocument
        const user = await User.findById(req.user.id);
        
        const quest = user.dailyQuests.id(questId);
        if (!quest) return res.status(404).json({ message: 'Quest not found' });
        
        if (!quest.isCompleted) return res.status(400).json({ message: 'Quest not completed yet' });
        if (quest.isClaimed) return res.status(400).json({ message: 'Quest already claimed' });
        
        // Give reward
        let rewardMsg = '';
        if (quest.rewardType === 'galleons') {
            let finalGalleons = quest.rewardAmount;
            
            // ── Divination buff ────────────────────────────────────────────────────────
            if (user.dailyDivination && user.dailyDivination.buffType === 'bonus_income_20' &&
                user.dailyDivination.expiryDate && new Date() < new Date(user.dailyDivination.expiryDate)) {
                finalGalleons = Math.floor(finalGalleons * 1.2);
            }

            user.balance += finalGalleons;
            rewardMsg = `ได้รับ ${finalGalleons} Galleons!`;
        } else if (quest.rewardType === 'material') {
            // Give a random common/uncommon/rare material
            const materials = await Item.find({ type: 'material', rarity: { $in: ['common', 'uncommon', 'rare'] } });
            if (materials.length > 0) {
                const randomMat = materials[Math.floor(Math.random() * materials.length)];
                // Filter ghost slots FIRST to prevent null.toString() crash
                user.inventory = user.inventory.filter(i => i.itemId != null);
                const existing = user.inventory.find(i => i.itemId.toString() === randomMat._id.toString());
                if (existing) {
                    existing.quantity += quest.rewardAmount;
                } else {
                    user.inventory.push({ itemId: randomMat._id, quantity: quest.rewardAmount });
                }
                rewardMsg = `ได้รับ ${randomMat.name} x${quest.rewardAmount}!`;
            } else {
                user.balance += 50; // fallback
                rewardMsg = `ได้รับ 50 Galleons!`;
            }
        }
        
        quest.isClaimed = true;
        // Filter out ghost inventory slots (itemId = null) to prevent Mongoose validation failures
        user.inventory = user.inventory.filter(i => i.itemId != null);
        user.markModified('inventory');
        await user.save();
        
        res.json({ message: rewardMsg, balance: user.balance, quests: user.dailyQuests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error: ' + (err.message || 'Unknown error') });
    }
});

module.exports = router;
