const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    transactionId: { type: String, required: true, unique: true },
    type: { type: String, enum: ['transfer', 'purchase', 'craft', 'admin_adjust'], required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientName: { type: String },
    amount: { type: Number, required: true },
    description: { type: String },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);
