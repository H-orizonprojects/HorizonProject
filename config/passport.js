const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'guilds', 'guilds.members.read']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log(`[OAuth] Login for ${profile.username} (${profile.id})`);

        // 1. Fetch User's Roles from the Specific Guild
        const GuildId = process.env.GUILD_ID ? process.env.GUILD_ID.trim() : null;
        let assignedRoles = ['student']; // Default role

        if (GuildId) {
            console.log(`[OAuth] Fetching roles from Guild: ${GuildId}`);
            try {
                const response = await fetch(`https://discord.com/api/users/@me/guilds/${GuildId}/member`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                if (response.ok) {
                    const memberData = await response.json();
                    const discordRoles = memberData.roles || [];
                    console.log(`[OAuth] Found roles: ${discordRoles.length}`);

                    // Map Discord Role IDs to Website Roles
                    if (process.env.ROLE_ADMIN_ID && discordRoles.includes(process.env.ROLE_ADMIN_ID.trim())) {
                        assignedRoles.push('admin', 'professor');
                    }

                    // Houses
                    if (process.env.ROLE_GARUDA_ID && discordRoles.includes(process.env.ROLE_GARUDA_ID.trim())) assignedRoles.push('garuda');
                    if (process.env.ROLE_NAGA_ID && discordRoles.includes(process.env.ROLE_NAGA_ID.trim())) assignedRoles.push('naga');
                    if (process.env.ROLE_QILIN_ID && discordRoles.includes(process.env.ROLE_QILIN_ID.trim())) assignedRoles.push('qilin');
                    if (process.env.ROLE_ERAWAN_ID && discordRoles.includes(process.env.ROLE_ERAWAN_ID.trim())) assignedRoles.push('erawan');
                } else {
                    console.error(`[OAuth] Failed to fetch member data: ${response.status} ${response.statusText}`);
                }
            } catch (err) {
                console.error('[OAuth] Error fetching guild roles:', err);
            }
        } else {
            console.log('[OAuth] No GUILD_ID configured, skipping role sync.');
        }

        let user = await User.findOne({ discordId: profile.id });
        if (user) {
            user.username = profile.username;
            user.avatar = profile.avatar;
            user.roles = assignedRoles; // Update roles on login
            await user.save();
            return done(null, user);
        } else {
            const newUser = new User({
                discordId: profile.id,
                username: profile.username,
                avatar: profile.avatar,
                roles: assignedRoles
            });
            await newUser.save();
            return done(null, newUser);
        }
    } catch (err) {
        console.error('[OAuth] Strategy Error:', err);
        return done(err, null);
    }
}));
