const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ['material', 'potion', 'equipment', 'quest'], required: true },
    price: { type: Number, required: true }, // Buy price
    sellPrice: { type: Number }, // Sell price (usually lower)
    image: { type: String }, // URL or path to image
    rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
    effects: { type: Object } // JSON for special effects stats
});

module.exports = mongoose.model('Item', itemSchema);
