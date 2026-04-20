const User = require('../models/User');

/**
 * Returns the last 8:00 AM Thai time (01:00 UTC) boundary before the given date.
 * This must match the same logic used in routes/quests.js.
 */
function getResetBoundary(dt) {
    const y = dt.getUTCFullYear();
    const mo = dt.getUTCMonth();
    const d = dt.getUTCDate();
    const h = dt.getUTCHours();

    let boundary = new Date(Date.UTC(y, mo, d, 1, 0, 0, 0));
    // If we haven't reached 01:00 UTC yet, the last reset was yesterday at 01:00 UTC
    if (h < 1) {
        boundary = new Date(Date.UTC(y, mo, d - 1, 1, 0, 0, 0));
    }
    return boundary;
}

/**
 * Updates the progress of a specific daily quest type for a user
 * @param {String} userId - The user's MongoDB ObjectId
 * @param {String} questType - 'explore_himmapan', 'craft_potion', 'buy_item', 'send_gift'
 * @param {Number} increment - How much to increment the progress
 */
async function updateQuestProgress(userId, questType, increment = 1) {
    try {
        const user = await User.findById(userId);
        if (!user || (!user.dailyQuests || user.dailyQuests.length === 0)) return;

        // Skip if the quest period has expired — the quests need to be regenerated
        // by the user opening the quest panel first. Use the same 8AM Thai / 01:00 UTC
        // boundary as routes/quests.js so both sides agree on "same quest period".
        const now = new Date();
        const last = user.lastQuestReset;
        if (!last || getResetBoundary(now).getTime() !== getResetBoundary(last).getTime()) {
            return; // Quests need to be regenerated first
        }

        let updated = false;
        for (let quest of user.dailyQuests) {
            if (quest.questType === questType && !quest.isCompleted) {
                quest.progress += increment;
                if (quest.progress >= quest.target) {
                    quest.progress = quest.target;
                    quest.isCompleted = true;
                }
                updated = true;
            }
        }

        if (updated) {
            await user.save();
        }
    } catch (err) {
        console.error('Error updating quest progress:', err);
    }
}

module.exports = { updateQuestProgress };
