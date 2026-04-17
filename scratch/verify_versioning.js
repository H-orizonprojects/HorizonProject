/**
 * Verification script for ResourceVersionManager
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const versionManager = require('../utils/version');
const Config = require('../models/Config');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        console.log('--- Testing Shop Version ---');
        const v1 = await versionManager.getVersion('shop');
        console.log('Current version:', v1);

        console.log('Incrementing...');
        const v2 = await versionManager.increment('shop');
        console.log('New version:', v2);

        if (parseInt(v2) > parseInt(v1)) {
            console.log('✅ Version incremented successfully');
        } else {
            console.log('❌ Version increment failed');
        }

        console.log('--- Cleanup ---');
        // Optional: Revert or keep it
        
        await mongoose.disconnect();
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

test();
