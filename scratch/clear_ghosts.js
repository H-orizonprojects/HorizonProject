require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    try {
        const users = await User.find({});
        let cleaned = 0;
        
        for (const user of users) {
             await user.populate('inventory.itemId'); // This maps deleted itemIds to null
             
             // Keep only items that successfully populated an itemId, OR are valid ObjectIds
             // If populated, valid items have typeof name === 'string'
             const initialLen = user.inventory.length;
             
             // filter out items where itemId resolved to null during populate
             const validInventory = user.inventory.filter(slot => slot.itemId != null);
             
             if (validInventory.length < initialLen) {
                 // Depopulate before saving to avoid CastErrors
                 user.inventory = validInventory.map(slot => ({
                     itemId: slot.itemId._id || slot.itemId,
                     quantity: slot.quantity
                 }));
                 
                 user.markModified('inventory');
                 await user.save();
                 cleaned++;
             }
        }
        
        console.log(`Cleaned ghost inventory slots from ${cleaned} users.`);
    } catch(err) {
        console.error(err);
    }
    process.exit();
});
