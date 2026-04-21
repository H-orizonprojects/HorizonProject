require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    try {
        let user = await User.findOne({ 'dailyQuests.rewardType': 'material', 'dailyQuests.isCompleted': true, 'dailyQuests.isClaimed': false });
        if (!user) {
            console.log('No user found');
            return;
        }
        
        let quest = user.dailyQuests.find(q => q.rewardType === 'material' && q.isCompleted && !q.isClaimed);
        let questId = quest._id.toString();
        
        // Exact code from quests.js
        console.log('Simulating for user', user.username);
        quest = user.dailyQuests.id(questId);
        
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
        } 
        
        quest.isClaimed = true;
        // Filter out ghost inventory slots (itemId = null) to prevent Mongoose validation failures
        user.inventory = user.inventory.filter(i => i.itemId != null);
        user.markModified('inventory');
        
        await user.save();
        console.log('Successfully saved!');
    } catch(e) {
        console.error('SERVER ERROR!', e);
    } finally {
        mongoose.disconnect();
    }
}
test();
