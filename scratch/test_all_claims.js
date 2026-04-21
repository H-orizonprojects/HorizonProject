require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');

async function testAll() {
    await mongoose.connect(process.env.MONGODB_URI);
    try {
        const users = await User.find({ 'dailyQuests.rewardType': 'material', 'dailyQuests.isCompleted': true, 'dailyQuests.isClaimed': false });
        console.log(`Found ${users.length} users with unclaimed material quests.`);
        
        let errorCount = 0;
        for (const user of users) {
             const questList = user.dailyQuests.filter(q => q.rewardType === 'material' && q.isCompleted && !q.isClaimed);
             for (const quest of questList) {
                  // replicate claim logic
                  const materials = await Item.find({ type: 'material', rarity: { $in: ['common', 'uncommon', 'rare'] } });
                  if (materials.length > 0) {
                      const randomMat = materials[Math.floor(Math.random() * materials.length)];
                      const existing = user.inventory.find(i => i.itemId && i.itemId.toString() === randomMat._id.toString());
                      if (existing) {
                          existing.quantity += quest.rewardAmount;
                      } else {
                          user.inventory.push({ itemId: randomMat._id, quantity: quest.rewardAmount });
                      }
                  }
                  quest.isClaimed = true;
             }
             user.inventory = user.inventory.filter(i => i.itemId != null);
             user.markModified('inventory');
             try {
                 await user.save();
             } catch (e) {
                 console.log(`Failed for user ${user.username} (${user.discordId}):`, e.message);
                 errorCount++;
             }
        }
        console.log(`Finished processing. Total errors: ${errorCount}`);
    } catch(e) {
        console.error('Error:', e);
    } finally {
        mongoose.disconnect();
    }
}
testAll();
