require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    try {
        const user = await User.findById('698de71f3951a4bea73186b8'); // The real user from the screenshot
        if (!user) return console.log('User not found');
        
        console.log('Quests:', user.dailyQuests);
        
        const materials = await Item.find({ type: 'material', rarity: { $in: ['common', 'uncommon', 'rare'] } });
        console.log('Found materials:', materials.length);
        
        if (materials.length > 0) {
            const randomMat = materials[Math.floor(Math.random() * materials.length)];
            console.log('Random mat:', randomMat.name, randomMat._id);
            const existing = user.inventory.find(i => i.itemId && i.itemId.toString() === randomMat._id.toString());
            if (existing) existing.quantity += 1;
            else user.inventory.push({ itemId: randomMat._id, quantity: 1 });
            console.log('Updated inventory');
        }        
        
        user.inventory = user.inventory.filter(i => i.itemId != null);
        await user.save();
        console.log('Save successful');
    } catch(e) {
        console.error('Error:', e);
    } finally {
        mongoose.disconnect();
    }
}
test();
