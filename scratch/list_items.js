require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('../models/Item');

async function listItems() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const items = await Item.find({}).select('name type price rarity').lean();
        console.log('--- ALL SHOP ITEMS ---');
        items.forEach(item => {
            console.log(`- ${item.name} (${item.type}) | Price: ${item.price} | Rarity: ${item.rarity}`);
        });
        
        const seedItems = items.filter(item => item.type === 'seed' || item.name.toLowerCase().includes('seed') || item.type === 'plants');
        console.log('\n--- SEED/PLANT ITEMS ---');
        seedItems.forEach(item => {
            console.log(`- ${item.name} (${item.type}) | Price: ${item.price} | Rarity: ${item.rarity}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
listItems();
