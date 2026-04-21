require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    try {
        const user = await User.findById('698de71f3951a4bea73186b8');
        
        // Find a material the user DOES NOT have
        const itemIds = user.inventory.map(i => i.itemId && i.itemId.toString()).filter(i => i);
        const newMat = await Item.findOne({ type: 'material', rarity: { $in: ['common', 'uncommon', 'rare'] }, _id: { $nin: itemIds } });
        
        console.log('Pushing new mat:', newMat.name);
        user.inventory.push({ itemId: newMat._id, quantity: 1 });
        await user.save();
        console.log('Save successful');
    } catch(e) {
        console.error('Error:', e);
    } finally {
        mongoose.disconnect();
    }
}
test();
