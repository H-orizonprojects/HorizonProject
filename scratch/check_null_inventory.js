require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    try {
        const users = await User.find({ 'inventory': { $elemMatch: { itemId: { $exists: false } } } });
        console.log('Users with missing itemId:', users.length);
        if (users.length > 0) {
            console.log('User IDs:', users.map(u => u.username));
            // Print the corrupted inventory entry
            users.forEach(u => {
                const badItems = u.inventory.filter(i => !i.itemId);
                console.log(u.username, badItems);
            });
        }
    } catch(err) {
        console.error(err);
    }
    process.exit();
});
