/**
 * @layer L7 — Application
 * Item model with indexes for fast filtered queries.
 *
 * Indexes:
 *   - name (unique) : used by duplicate check in POST /shop/add
 *   - type          : used by ?type= filter in GET /shop/items
 */

const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true, index: true },         // L7: indexed for duplicate-check
    description: { type: String },
    type: { type: String, enum: ['material', 'potion', 'equipment', 'quest', 'food', 'seed', 'egg'], required: true, index: true }, // L7: indexed for type filter
    price: { type: Number, required: true }, // Buy price
    sellPrice: { type: Number }, // Sell price (usually lower)
    image: { type: String }, // URL or path to image (store URL, not Base64)
    rarity: { type: String, enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'], default: 'common' },
    effects: { type: Object }, // JSON for special effects stats
    mailboxMessage: { type: String } // Message sent to mailbox when equipment is purchased
}, {
    toJSON: { versionKey: false }
});

module.exports = mongoose.model('Item', itemSchema);
