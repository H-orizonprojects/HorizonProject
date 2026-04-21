const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAuthenticated, isNotDetained } = require('../middleware/auth');

// ─── Reading Tables ──────────────────────────────────────────────────────────

const TEA_LEAVES = [
    // Good omens
    { symbol: 'Sun', emoji: '☀️', isOmen: false, buffType: 'bonus_income_20', buffName: 'Blessing of the Sun', desc: 'รายได้ทุกทางเพิ่ม 20% ตลอดวันนี้', effect: '+20% income' },
    { symbol: 'Star', emoji: '⭐', isOmen: false, buffType: 'bonus_daily_reward', buffName: 'Star\'s Favour', desc: 'รับ Galleons เพิ่ม 50 เมื่อเก็บรางวัลรายวัน', effect: '+50G daily reward' },
    { symbol: 'Crown', emoji: '👑', isOmen: false, buffType: 'shop_discount', buffName: 'Merchant\'s Crown', desc: 'ไอเทมทุกชิ้นในร้านค้าลดราคา 10% เฉพาะวันนี้', effect: '10% shop discount' },
    { symbol: 'Flower', emoji: '🌸', isOmen: false, buffType: 'herb_boost', buffName: 'Garden Blessing', desc: 'สมุนไพรในแปลงเติบโตเร็วขึ้น 30% วันนี้', effect: '+30% herb growth' },
    { symbol: 'Bird', emoji: '🕊️', isOmen: false, buffType: 'extra_forest_entry', buffName: 'Wings of Fortune', desc: 'เข้าป่าหิมพานต์ได้เพิ่มอีก 1 ครั้งวันนี้', effect: '+1 forest entry' },
    { symbol: 'Ship', emoji: '⛵', isOmen: false, buffType: 'craft_bonus', buffName: 'Swift Voyage', desc: 'การคราฟต์ทุกชนิดมีโอกาสสำเร็จ +10% วันนี้', effect: '+10% craft success' },
    { symbol: 'Ring', emoji: '💍', isOmen: false, buffType: 'gift_bonus', buffName: 'Ring of Friendship', desc: 'เงินที่รับจากของขวัญเพิ่มขึ้น 20% วันนี้', effect: '+20% gift income' },
    // Bad omens
    { symbol: 'Grim', emoji: '☠️', isOmen: true, buffType: 'omen_grim', buffName: 'The Grim', desc: 'ลางร้าย! HP ลดเร็วกว่าปกติ และคุณต้องต้มยาแก้สาปภายใน 2 ชั่วโมง', effect: 'HP drains faster' },
    { symbol: 'Storm', emoji: '⛈️', isOmen: true, buffType: 'omen_storm', buffName: 'Storm\'s Wrath', desc: 'ลางร้าย! โอกาสของตกทุกทางลดลง 15% วันนี้', effect: '-15% drop rates' },
    { symbol: 'Snake', emoji: '🐍', isOmen: true, buffType: 'omen_snake', buffName: 'Serpent\'s Hex', desc: 'ลางร้าย! การคราฟต์มีโอกาสล้มเหลว +20% วันนี้', effect: '+20% craft failure' },
    { symbol: 'Broken Crown', emoji: '💔', isOmen: true, buffType: 'omen_broken', buffName: 'Broken Crown', desc: 'ลางร้าย! ราคาสินค้าในร้านเพิ่มขึ้น 10% สำหรับคุณวันนี้', effect: '+10% shop prices' },
];

const TAROT_CARDS = [
    // Good
    { symbol: 'The Star', emoji: '🌟', isOmen: false, buffType: 'bonus_income_20', buffName: 'The Star', desc: 'ดวงงาม! รายได้ทุกทางเพิ่ม 20% ตลอดวันนี้', effect: '+20% income' },
    { symbol: 'The Sun', emoji: '🌞', isOmen: false, buffType: 'bonus_daily_reward', buffName: 'The Sun', desc: 'วันแห่งความเจริญ! รับโบนัส 50G ในรางวัลรายวัน', effect: '+50G daily reward' },
    { symbol: 'The Empress', emoji: '🌿', isOmen: false, buffType: 'herb_boost', buffName: 'The Empress', desc: 'พลังแห่งธรรมชาติ! สมุนไพรโตเร็วขึ้น 30%', effect: '+30% herb growth' },
    { symbol: 'The Merchant', emoji: '🛍️', isOmen: false, buffType: 'shop_discount', buffName: 'The Merchant', desc: 'ไอเทมในร้านค้าลดราคา 10% เฉพาะคุณวันนี้', effect: '10% shop discount' },
    { symbol: 'The Chariot', emoji: '⚡', isOmen: false, buffType: 'craft_bonus', buffName: 'The Chariot', desc: 'พลังความเร็ว! การคราฟต์มีโอกาสสำเร็จ +15% วันนี้', effect: '+15% craft success' },
    { symbol: 'The World', emoji: '🌍', isOmen: false, buffType: 'extra_forest_entry', buffName: 'The World', desc: 'โลกเปิดกว้าง! เข้าป่าได้เพิ่มอีก 1 ครั้ง', effect: '+1 forest entry' },
    { symbol: 'The Lovers', emoji: '💑', isOmen: false, buffType: 'gift_bonus', buffName: 'The Lovers', desc: 'พลังความรัก! ของขวัญที่รับได้เพิ่ม 20%', effect: '+20% gift income' },
    { symbol: 'The Harvest', emoji: '🌾', isOmen: false, buffType: 'herb_double_chance', buffName: 'The Harvest', desc: 'ฤดูเก็บเกี่ยว! โอกาสได้สมุนไพร x2 เพิ่ม 20%', effect: '+20% double herb drop' },
    // Bad omens
    { symbol: 'The Fool', emoji: '🃏', isOmen: true, buffType: 'omen_fool', buffName: 'The Fool', desc: 'ลางร้าย! การหมุนหม้อปรุงยาเร็วขึ้นแต่มีโอกาสผิดพลาดสูง', effect: 'Risky crafting' },
    { symbol: 'The Tower', emoji: '🗼', isOmen: true, buffType: 'omen_tower', buffName: 'The Tower', desc: 'หายนะมาเยือน! HP ลดเร็วกว่าปกติ วันนี้ต้องระวัง', effect: 'HP drains faster' },
    { symbol: 'The Devil', emoji: '😈', isOmen: true, buffType: 'omen_devil', buffName: 'The Devil', desc: 'ลางร้าย! ราคาสินค้าในร้านเพิ่ม 10% สำหรับวันนี้', effect: '+10% shop prices' },
    { symbol: 'The Moon', emoji: '🌑', isOmen: true, buffType: 'omen_moon', buffName: 'The Moon (Dark)', desc: 'ความมืดมาเยือน! โอกาสของตกในป่าลดลง 15%', effect: '-15% forest drops' },
];

const ALL_READINGS = { tea_leaves: TEA_LEAVES, tarot: TAROT_CARDS };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNextMidnightTH() {
    const now = new Date();
    const thTime = new Date(now.getTime() + 7 * 3600 * 1000);
    // Next midnight in TH = next day at 00:00 TH = 17:00 UTC
    const nextMidnightTh = new Date(Date.UTC(
        thTime.getUTCFullYear(), thTime.getUTCMonth(), thTime.getUTCDate() + 1,
        -7, 0, 0, 0
    ));
    return nextMidnightTh;
}

function isBuffActive(user) {
    return user.dailyDivination &&
           user.dailyDivination.expiryDate &&
           new Date() < new Date(user.dailyDivination.expiryDate);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/divination/status
router.get('/status', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        // Check if curse quest deadline has passed → apply penalty
        if (user.curseQuest && user.curseQuest.isActive && !user.curseQuest.isCleansed) {
            if (new Date() > new Date(user.curseQuest.deadlineAt)) {
                // Apply penalty
                user.balance = Math.max(0, user.balance - user.curseQuest.penaltyGalleons);
                user.curseQuest.isActive = false;
                await user.save();
            }
        }

        const active = isBuffActive(user);
        const currentReading = active ? user.dailyDivination : null;

        // Find the full reading object for rich data
        let readingDetail = null;
        if (currentReading && currentReading.buffType) {
            const pool = ALL_READINGS[currentReading.readingType] || [...TEA_LEAVES, ...TAROT_CARDS];
            readingDetail = pool.find(r => r.buffType === currentReading.buffType) || null;
        }

        res.json({
            canDraw: !active,
            currentReading: readingDetail,
            buffType: currentReading?.buffType || null,
            buffName: currentReading?.buffName || null,
            isOmen: currentReading?.isOmen || false,
            symbol: currentReading?.symbol || null,
            readingType: currentReading?.readingType || null,
            expiryDate: currentReading?.expiryDate || null,
            curseQuest: user.curseQuest || null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching divination status.' });
    }
});

// POST /api/divination/draw
router.post('/draw', isAuthenticated, isNotDetained, async (req, res) => {
    try {
        const { readingType } = req.body; // 'tea_leaves' | 'tarot'
        const user = await User.findById(req.user._id);

        if (isBuffActive(user)) {
            return res.status(400).json({ message: '🔮 The stars have already spoken to you today. Come back tomorrow.' });
        }

        const type = (readingType === 'tarot' || readingType === 'tea_leaves') ? readingType : 'tea_leaves';
        const pool = ALL_READINGS[type];
        const reading = pool[Math.floor(Math.random() * pool.length)];

        const expiryDate = getNextMidnightTH();

        user.dailyDivination = {
            buffType: reading.buffType,
            buffName: reading.buffName,
            isOmen: reading.isOmen,
            readingType: type,
            symbol: reading.symbol,
            expiryDate
        };

        // If bad omen → create curse quest
        if (reading.isOmen) {
            user.curseQuest = {
                isActive: true,
                questType: 'craft_cleansing_potion',
                deadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
                penaltyGalleons: 50,
                isCleansed: false
            };

            // Immediate HP penalty for grim/tower
            if (reading.buffType === 'omen_grim' || reading.buffType === 'omen_tower') {
                user.health = Math.max(0, (user.health || user.maxHealth || 100) - 30);
                reading.desc += ' (HP ของคุณลดลง 30 หน่วยทันที!)';
            }
        } else {
            // Clear any old curse quest if good omen drawn
            user.curseQuest = { isActive: false, isCleansed: false, deadlineAt: null, penaltyGalleons: 50, questType: 'craft_cleansing_potion' };
        }

        await user.save();

        res.json({
            message: reading.isOmen
                ? `${reading.emoji} ${reading.symbol}... ลางร้ายเคลื่อนมาใกล้! คุณถูกสาป — ต้มยาแก้สาปภายใน 2 ชั่วโมงหรือเสีย 50G!`
                : `${reading.emoji} ${reading.symbol} — ${reading.desc}`,
            reading,
            curseQuest: user.curseQuest || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'The crystal ball is clouded. Try again later.' });
    }
});

// POST /api/divination/cleanse — use Cleansing Potion to remove curse
router.post('/cleanse', isAuthenticated, isNotDetained, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user.curseQuest || !user.curseQuest.isActive) {
            return res.status(400).json({ message: 'You are not currently cursed.' });
        }
        if (user.curseQuest.isCleansed) {
            return res.status(400).json({ message: 'The curse has already been cleansed.' });
        }
        if (new Date() > new Date(user.curseQuest.deadlineAt)) {
            return res.status(400).json({ message: 'The deadline has passed. The penalty has already been applied.' });
        }

        // Find Cleansing Potion in inventory
        const Item = require('../models/Item');
        const cleansingPotion = await Item.findOne({ name: 'Cleansing Potion' });
        if (!cleansingPotion) return res.status(400).json({ message: 'Cleansing Potion does not exist yet.' });

        // Filter ghost slots FIRST to prevent null.toString() crash
        user.inventory = user.inventory.filter(i => i.itemId != null);
        const potionSlot = user.inventory.find(i => i.itemId.toString() === cleansingPotion._id.toString());
        if (!potionSlot || potionSlot.quantity < 1) {
            return res.status(400).json({ message: '🧪 คุณไม่มี Cleansing Potion! รีบไปคราฟต์ที่ Craft Station!' });
        }

        // Consume potion
        potionSlot.quantity -= 1;
        if (potionSlot.quantity <= 0) {
            user.inventory = user.inventory.filter(i => i.itemId.toString() !== cleansingPotion._id.toString());
        }

        user.curseQuest.isCleansed = true;
        user.curseQuest.isActive = false;

        user.markModified('inventory');
        await user.save();

        res.json({
            message: '✨ คาถาสาปถูกล้างแล้ว! คุณปลอดภัยแล้ว ไม่มีการหักเงิน',
            curseQuest: user.curseQuest
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during cleansing.' });
    }
});

module.exports = router;
module.exports.ALL_READINGS = ALL_READINGS;
