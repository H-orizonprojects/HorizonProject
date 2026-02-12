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
        // 1. Fetch User's Roles from the Specific Guild
        const GuildId = process.env.GUILD_ID;
        let assignedRoles = ['student']; // Default role

        if (GuildId) {
            try {
                const response = await fetch(`https://discord.com/api/users/@me/guilds/${GuildId}/member`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                if (response.ok) {
                    const memberData = await response.json();
                    const discordRoles = memberData.roles; // Array of Role IDs

                    // Map Discord Role IDs to Website Roles
                    if (discordRoles.includes(process.env.ROLE_ADMIN_ID)) assignedRoles.push('admin');
                    if (discordRoles.includes(process.env.ROLE_ADMIN_ID)) assignedRoles.push('professor'); // Admin is Professor

                    // Houses
                    if (discordRoles.includes(process.env.ROLE_GARUDA_ID)) assignedRoles.push('garuda');
                    if (discordRoles.includes(process.env.ROLE_NAGA_ID)) assignedRoles.push('naga');
                    if (discordRoles.includes(process.env.ROLE_QILIN_ID)) assignedRoles.push('qilin');
                    if (discordRoles.includes(process.env.ROLE_ERAWAN_ID)) assignedRoles.push('erawan');
                }
            } catch (err) {
                console.error('Failed to fetch guild roles:', err);
            }
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
        return done(err, null);
    }
}));
