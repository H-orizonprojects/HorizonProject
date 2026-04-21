const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Item = require('../models/Item');

const ensureAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: 'Not authenticated' });
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const isToday = (date) => {
    if (!date) return false;
    const d = new Date(date);
    const now = new Date();
    return d.getDate() === now.getDate() &&
           d.getMonth() === now.getMonth() &&
           d.getFullYear() === now.getFullYear();
};

// Species → buff mapping
const SPECIES_BUFFS = {
    owl:        [{ target: 'shop_bonus_chance', value: 10 }],
    toad:       [{ target: 'herb_double_chance', value: 15 }],
    kneazle:    [{ target: 'craft_safety', value: 15 }],
    seal:       [{ target: 'heal_chance', value: 15 }],
    puffskein:  [{ target: 'max_hp', value: 10 }],
    niffler:    [{ target: 'max_hp', value: 15 }, { target: 'shop_bonus_chance', value: 5 }],
    hippogriff: [{ target: 'max_hp', value: 30 }, { target: 'herb_double_chance', value: 10 }],
    thestral:   [{ target: 'max_hp', value: 25 }, { target: 'craft_safety', value: 10 }],
    dragon:     [{ target: 'max_hp', value: 50 }, { target: 'heal_chance', value: 10 }],
    qilin:      [{ target: 'max_hp', value: 50 }, { target: 'shop_bonus_chance', value: 15 }, { target: 'herb_double_chance', value: 15 }],
};

// Rarity → possible species
const SPECIES_BY_RARITY = {
    common:    [{ name: 'Fluffy Owl', species: 'owl' }, { name: 'Magic Toad', species: 'toad' }, { name: 'Puffskein', species: 'puffskein' }],
    rare:      [{ name: 'Kneazle', species: 'kneazle' }, { name: 'Baby Niffler', species: 'niffler' }, { name: 'Arctic Seal', species: 'seal' }],
    epic:      [{ name: 'Hippogriff Foal', species: 'hippogriff' }, { name: 'Thestral Foal', species: 'thestral' }],
    legendary: [{ name: 'Baby Dragon', species: 'dragon' }, { name: 'Golden Qilin', species: 'qilin' }],
};

const SPECIES_IMAGES = {
    owl:        'assets/images/pets/owl.png',
    toad:       'assets/images/pets/toad.png',
    puffskein:  'assets/images/pets/puffskein.png',
    kneazle:    'assets/images/pets/kneazle.png',
    niffler:    'assets/images/pets/niffler.png',
    seal:       'assets/images/pets/seal.png',
    hippogriff: 'assets/images/pets/hippogriff.png',
    thestral:   'assets/images/pets/thestral.png',
    dragon:     'assets/images/pets/dragon.png',
    qilin:      'assets/images/pets/qilin.png',
};

const INCUBATION_HOURS = 72;

// Helper: get active pet object from user
function getActivePet(user) {
    if (!user.activePetId) return null;
    return user.pets.find(p => p._id.toString() === user.activePetId.toString()) || null;
}

// ─── Routes ────────────────────────────────────────────────────────────────

// 1. Get pets & incubator data
router.get('/', ensureAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('incubator pets activePetId');
        // Check if egg is now ready
        if (user.incubator && user.incubator.hatchAt && !user.incubator.isReadyToHatch) {
            if (new Date() >= new Date(user.incubator.hatchAt)) {
                user.incubator.isReadyToHatch = true;
                await user.save();
            }
        }
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error fetching pets data' });
    }
});

// 2. Place egg into incubator
router.post('/incubate', ensureAuth, async (req, res) => {
    try {
        const { itemId } = req.body;
        const user = await User.findById(req.user._id);

        if (user.pets && user.pets.length >= 3) {
            return res.status(400).json({ message: 'You already have the maximum number of familiars (3).' });
        }

        if (user.incubator && user.incubator.eggItemId) {
            return res.status(400).json({ message: 'Incubator is already occupied!' });
        }

        // Filter ghost slots FIRST to prevent null.toString() crash
        user.inventory = user.inventory.filter(i => i.itemId != null);
        const invItemIndex = user.inventory.findIndex(i => i.itemId.toString() === itemId);
        if (invItemIndex === -1 || user.inventory[invItemIndex].quantity < 1) {
            return res.status(400).json({ message: 'You do not own this egg.' });
        }

        const itemInfo = await Item.findById(itemId);
        if (!itemInfo || itemInfo.type !== 'egg') {
            return res.status(400).json({ message: 'This item is not a valid egg.' });
        }

        // Deduct egg
        user.inventory[invItemIndex].quantity -= 1;
        if (user.inventory[invItemIndex].quantity <= 0) {
            user.inventory.splice(invItemIndex, 1);
        }

        const hatchAt = new Date(Date.now() + INCUBATION_HOURS * 60 * 60 * 1000);

        user.incubator = {
            eggItemId: itemInfo._id,
            eggName: itemInfo.name,
            eggImage: itemInfo.image,
            eggRarity: itemInfo.rarity || 'common',
            hatchAt,
            potionBoostHours: 0,
            isReadyToHatch: false
        };

        await user.save();
        res.json({ message: `🥚 ${itemInfo.name} placed in the incubator! It will hatch in 72 hours.`, incubator: user.incubator, inventory: user.inventory });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error placing egg.' });
    }
});

// 3. Use Incubation Potion to boost hatching (-24hr per potion)
router.post('/boost', ensureAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const inc = user.incubator;

        if (!inc || !inc.eggItemId) {
            return res.status(400).json({ message: 'Incubator is empty.' });
        }
        if (inc.isReadyToHatch) {
            return res.status(400).json({ message: 'The egg is already ready to hatch!' });
        }

        // Find Incubation Potion in inventory
        const potionItem = await Item.findOne({ name: 'Incubation Potion' });
        if (!potionItem) return res.status(400).json({ message: 'Incubation Potion does not exist yet.' });

        // Filter ghost slots FIRST to prevent null.toString() crash
        user.inventory = user.inventory.filter(i => i.itemId != null);
        const potionSlot = user.inventory.find(i => i.itemId.toString() === potionItem._id.toString());
        if (!potionSlot || potionSlot.quantity < 1) {
            return res.status(400).json({ message: 'You do not have an Incubation Potion in your inventory.' });
        }

        // Consume potion
        potionSlot.quantity -= 1;
        if (potionSlot.quantity <= 0) {
            user.inventory = user.inventory.filter(i => i.itemId.toString() !== potionItem._id.toString());
        }

        // Subtract 24hr from hatchAt
        const BOOST_HOURS = 24;
        const currentHatchAt = new Date(inc.hatchAt);
        const newHatchAt = new Date(currentHatchAt.getTime() - BOOST_HOURS * 60 * 60 * 1000);
        const now = new Date();

        if (newHatchAt <= now) {
            inc.hatchAt = now;
            inc.isReadyToHatch = true;
        } else {
            inc.hatchAt = newHatchAt;
        }
        inc.potionBoostHours = (inc.potionBoostHours || 0) + BOOST_HOURS;

        user.markModified('inventory');
        await user.save();

        const msg = inc.isReadyToHatch
            ? '✨ The egg glows brilliantly — it is ready to hatch NOW!'
            : `⚗️ Incubation Potion used! Hatching accelerated by 24 hours.`;
        res.json({ message: msg, incubator: inc, inventory: user.inventory });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error boosting incubator.' });
    }
});

// 4. Hatch egg
router.post('/hatch', ensureAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const inc = user.incubator;

        if (!inc || !inc.eggItemId) {
            return res.status(400).json({ message: 'There is no egg in the incubator.' });
        }

        // Check time even if isReadyToHatch wasn't flagged yet
        if (!inc.isReadyToHatch && new Date() < new Date(inc.hatchAt)) {
            const remaining = new Date(inc.hatchAt) - new Date();
            const hrs = Math.floor(remaining / 3600000);
            const mins = Math.floor((remaining % 3600000) / 60000);
            return res.status(400).json({ message: `The egg is still incubating. ${hrs}h ${mins}m remaining.` });
        }

        const rarity = inc.eggRarity || 'common';
        const pool = SPECIES_BY_RARITY[rarity] || SPECIES_BY_RARITY['common'];
        const chosen = pool[Math.floor(Math.random() * pool.length)];

        const buffs = SPECIES_BUFFS[chosen.species] || [{ target: 'max_hp', value: 5 }];

        const newPet = {
            name: chosen.name,
            species: chosen.species,
            petType: chosen.species,
            image: SPECIES_IMAGES[chosen.species] || inc.eggImage,
            rarity,
            buffs,
            hunger: 70,
            affection: 10,
            affectionLevel: 1,
            lastFed: null,
            lastPetted: null,
            acquiredAt: new Date()
        };

        user.pets.push(newPet);

        // Clear incubator
        user.incubator = {
            eggItemId: null,
            eggName: null,
            eggImage: null,
            eggRarity: 'common',
            hatchAt: null,
            potionBoostHours: 0,
            isReadyToHatch: false
        };

        await user.save();

        const insertedPet = user.pets[user.pets.length - 1];
        res.json({
            message: `🐣 Your egg has hatched into a ${chosen.name}! Welcome to your new familiar!`,
            pet: insertedPet,
            incubator: user.incubator
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error hatching egg.' });
    }
});

// 5. Equip / unequip active pet
router.post('/equip', ensureAuth, async (req, res) => {
    try {
        const { petId } = req.body;
        const user = await User.findById(req.user._id);

        let newMaxHp = 100;

        if (!petId) {
            user.activePetId = null;
            user.maxHealth = newMaxHp;
            if (user.health > user.maxHealth) user.health = user.maxHealth;
            await user.save();
            return res.json({ message: 'Pet unequipped.', activePetId: null, maxHealth: user.maxHealth });
        }

        const pet = user.pets.find(p => p._id.toString() === petId);
        if (!pet) return res.status(400).json({ message: 'Pet not found in your collection.' });

        // Apply max_hp buff
        const hpBuff = pet.buffs.find(b => b.target === 'max_hp');
        if (hpBuff) newMaxHp += hpBuff.value;

        user.activePetId = petId;
        user.maxHealth = newMaxHp;
        if (user.health > user.maxHealth) user.health = user.maxHealth;
        await user.save();
        res.json({
            message: `✨ ${pet.name} is now your active familiar!`,
            activePetId: petId,
            maxHealth: user.maxHealth,
            buffs: pet.buffs
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error equipping pet.' });
    }
});

// 6. Feed pet
router.post('/feed', ensureAuth, async (req, res) => {
    try {
        const { petId } = req.body;
        const user = await User.findById(req.user._id);

        const pet = user.pets.find(p => p._id.toString() === petId);
        if (!pet) return res.status(404).json({ message: 'Pet not found.' });

        // Filter ghost slots FIRST to prevent null.toString() crash
        user.inventory = user.inventory.filter(i => i.itemId != null);

        // Get all items in user's inventory to find available pet food
        const invItemIds = user.inventory.map(i => i.itemId);
        const invItems = await Item.find({ _id: { $in: invItemIds } });

        let consumedItemId = null;
        for (const item of invItems) {
            const isPetFood = item.name.toLowerCase().includes('feed') || item.name.toLowerCase().includes('อาหารสัตว์') || (item.description && item.description.includes('สัตว์'));
            if (isPetFood) {
                const slot = user.inventory.find(i => i.itemId.toString() === item._id.toString());
                if (slot && slot.quantity > 0) {
                    consumedItemId = item._id.toString();
                    break;
                }
            }
        }

        if (!consumedItemId) {
            return res.status(400).json({ message: 'You do not have any pet food in your inventory. Buy some from the shop!' });
        }

        const feedSlot = user.inventory.find(i => i.itemId.toString() === consumedItemId);
        feedSlot.quantity -= 1;
        if (feedSlot.quantity <= 0) {
            user.inventory = user.inventory.filter(i => i.itemId.toString() !== consumedItemId);
        }

        // Restore hunger
        pet.hunger = Math.min(100, (pet.hunger || 0) + 30);

        // Daily affection bonus for feeding
        let affectionMsg = '';
        if (!isToday(pet.lastFed)) {
            pet.affection = Math.min(100, (pet.affection || 0) + 10);
            affectionMsg = ' +10 affection for feeding today!';
            pet.lastFed = new Date();
            // Check affection level up
            if (pet.affection >= 80 && pet.affectionLevel < 3) {
                pet.affectionLevel = 3;
            } else if (pet.affection >= 40 && pet.affectionLevel < 2) {
                pet.affectionLevel = 2;
            }
        } else {
            pet.lastFed = new Date();
        }

        user.markModified('inventory');
        user.markModified('pets');
        await user.save();

        res.json({
            message: `🍖 ${pet.name} munches happily!${affectionMsg}`,
            pet,
            inventory: user.inventory
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error feeding pet.' });
    }
});

// 7. Pat/pet the familiar (daily affection)
router.post('/pat', ensureAuth, async (req, res) => {
    try {
        const { petId } = req.body;
        const user = await User.findById(req.user._id);

        const pet = user.pets.find(p => p._id.toString() === petId);
        if (!pet) return res.status(404).json({ message: 'Pet not found.' });

        if (isToday(pet.lastPetted)) {
            return res.status(400).json({ message: `${pet.name} already had their head patted today. Come back tomorrow! 💕` });
        }

        pet.affection = Math.min(100, (pet.affection || 0) + 5);
        pet.lastPetted = new Date();

        // Check affection level up
        if (pet.affection >= 80 && pet.affectionLevel < 3) {
            pet.affectionLevel = 3;
        } else if (pet.affection >= 40 && pet.affectionLevel < 2) {
            pet.affectionLevel = 2;
        }

        user.markModified('pets');
        await user.save();

        res.json({
            message: `💖 ${pet.name} purrs with delight! +5 affection.`,
            pet
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error patting pet.' });
    }
});

// 8. Get active pet buff info (for other systems to fetch)
router.get('/active-buff', ensureAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('pets activePetId');
        const pet = getActivePet(user);
        res.json({ pet: pet || null, buffs: pet ? pet.buffs : [] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// 9. Transfer pet to another user
router.post('/transfer', ensureAuth, async (req, res) => {
    try {
        const { petId, recipientUsername } = req.body;
        if (!petId || !recipientUsername) {
            return res.status(400).json({ message: 'Pet ID and recipient username are required.' });
        }

        const sender = await User.findById(req.user._id);
        const recipient = await User.findOne({ username: { $regex: new RegExp(`^${recipientUsername}$`, 'i') } });

        if (!recipient) {
            return res.status(404).json({ message: 'Recipient not found.' });
        }
        if (sender._id.toString() === recipient._id.toString()) {
            return res.status(400).json({ message: 'You cannot transfer a pet to yourself.' });
        }
        if (recipient.pets && recipient.pets.length >= 3) {
            return res.status(400).json({ message: `${recipient.username} already has the maximum number of familiars (3).` });
        }

        const petIndex = sender.pets.findIndex(p => p._id.toString() === petId);
        if (petIndex === -1) {
            return res.status(400).json({ message: 'Pet not found in your collection.' });
        }

        const petToTransfer = sender.pets[petIndex];

        // Unequip if active
        if (sender.activePetId && sender.activePetId.toString() === petId) {
            sender.activePetId = null;
            // Recalculate max health without this pet
            let newMaxHp = 100;
            sender.maxHealth = newMaxHp;
            if (sender.health > sender.maxHealth) sender.health = sender.maxHealth;
        }

        // Remove from sender
        sender.pets.splice(petIndex, 1);
        
        // Add to recipient
        recipient.pets.push(petToTransfer);

        await sender.save();
        await recipient.save();

        res.json({ message: `🦉 Successfully transferred ${petToTransfer.name} to ${recipient.username}!` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error transferring pet.' });
    }
});

module.exports = router;
module.exports.getActivePet = getActivePet;
module.exports.SPECIES_BUFFS = SPECIES_BUFFS;
