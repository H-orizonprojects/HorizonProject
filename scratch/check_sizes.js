require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('../models/Item');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const items = await Item.find().lean();
        const sorted = items
            .map(i => ({ name: i.name, size: (i.image || '').length }))
            .sort((a, b) => b.size - a.size);
        
        console.log('Top 10 largest items:');
        sorted.slice(0, 10).forEach(i => {
            console.log(`${i.name}: ${(i.size / 1024).toFixed(2)} KB`);
        });

        const totalSize = sorted.reduce((acc, i) => acc + i.size, 0);
        console.log('Total images size:', (totalSize / 1024).toFixed(2), 'KB');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
