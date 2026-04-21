require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    try {
        let user = new User({
            discordId: "TEST_CLAIM_XYZ",
            username: "TestClaimXYZ",
            dailyQuests: [{
                questType: 'explore_himmapan',
                target: 2,
                progress: 2,
                isCompleted: true,
                isClaimed: false,
                rewardType: 'material',
                rewardAmount: 1
            }],
            inventory: []
        });
        await user.save();
        
        let quest = user.dailyQuests[0];
        let questId = quest._id.toString();
        
        console.log('User created:', user._id);
        
        // Exact code from quests.js claim
        const materials = await Item.find({ type: 'material', rarity: { $in: ['common', 'uncommon', 'rare'] } });
        console.log('Materials found:', materials.length);
        if (materials.length > 0) {
            const randomMat = materials[Math.floor(Math.random() * materials.length)];
            console.log('Random mat:', randomMat.name);
            user.inventory = user.inventory.filter(i => i && i.itemId != null);
            const existing = user.inventory.find(i => i.itemId.toString() === randomMat._id.toString());
            if (existing) {
                existing.quantity += quest.rewardAmount;
            } else {
                user.inventory.push({ itemId: randomMat._id, quantity: quest.rewardAmount });
            }
        } 
        
        quest.isClaimed = true;
        user.inventory = user.inventory.filter(i => i && i.itemId != null);
        user.markModified('inventory');
        
        await user.save();
        console.log('Successfully saved user with inventory modified!');
        
        // Cleanup
        await User.findByIdAndDelete(user._id);
    } catch(e) {
        console.error('SERVER ERROR!', e);
    } finally {
        mongoose.disconnect();
    }
}
test();
