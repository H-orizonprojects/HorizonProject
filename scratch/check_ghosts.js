require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User'); // fixed path
const Item = require('../models/Item');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    try {
        const user = await User.findOne({username: 'lilithcxz_'});
        if (!user) return process.exit();
        
        await user.populate('inventory.itemId');
        const ghostSlots = user.inventory.filter(i => !i.itemId);
        
        console.log('Ghost slots found:', ghostSlots.length);
        
        // Let's identify the current Item IDs for TomYum and Tea to see if they're different
        const tomYum = await Item.findOne({name: 'ต้มยำ'});
        const tea = await Item.findOne({name: 'ชาอัญชัน'});
        console.log('Current Tom Yum ID:', tomYum ? tomYum._id : 'Not Found');
        console.log('Current Tea ID:', tea ? tea._id : 'Not Found');
        
    } catch(err) {
        console.error(err);
    }
    process.exit();
});
