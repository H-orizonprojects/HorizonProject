const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
    resultItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    ingredients: [{
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        quantity: { type: Number, required: true }
    }],
    craftingType: { type: String, enum: ['cauldron', 'machine', 'forge'], required: true },
    craftingTime: { type: Number, default: 0 }, // In seconds
    requiredLevel: { type: Number, default: 1 }
});

module.exports = mongoose.model('Recipe', recipeSchema);
