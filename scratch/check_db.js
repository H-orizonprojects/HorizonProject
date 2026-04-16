require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('../models/Item');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const count = await Item.countDocuments();
        console.log('Total items in DB:', count);
        const oneItem = await Item.findOne();
        if (oneItem) {
            console.log('Sample item name:', oneItem.name);
            console.log('Sample item image size:', oneItem.image ? oneItem.image.length : 0);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
