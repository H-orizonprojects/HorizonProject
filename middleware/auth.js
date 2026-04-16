const User = require('../models/User');

const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
};

const hasRole = (roles) => {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const userRoles = req.user.roles || [];
        const hasPermission = roles.some(role => userRoles.includes(role));
        if (hasPermission || userRoles.includes('admin')) {
            return next();
        }
        res.status(403).json({ message: 'Forbidden' });
    }
};

// ตรวจสอบ guild membership โดยใช้ Bot Token (ไม่หมดอายุ)
async function checkGuildWithBot(discordId) {
    const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
    const guildId = process.env.GUILD_ID?.trim();

    if (!botToken) throw new Error('BOT_TOKEN_NOT_CONFIGURED');
    if (!guildId) throw new Error('GUILD_ID_NOT_CONFIGURED');

    const response = await fetch(
        `https://discord.com/api/guilds/${guildId}/members/${discordId}`,
        { headers: { Authorization: `Bot ${botToken}` } }
    );

    if (response.status === 404) return null; // ไม่อยู่ใน guild
    if (!response.ok) throw new Error(`Discord API error: ${response.status}`);
    return await response.json(); // member data พร้อม roles[]
}

const GUILD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

const checkGuildMembership = async (req, res, next) => {
    // ตรวจว่าเป็น AJAX/fetch request หรือไม่
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest'
        || (req.headers['accept'] && req.headers['accept'].includes('application/json'))
        || req.originalUrl.startsWith('/api/');

    // ถ้าไม่ได้ login
    if (!req.isAuthenticated()) {
        return isAjax
            ? res.status(401).json({ authenticated: false, error: 'not_logged_in', redirect: '/' })
            : res.redirect('/?error=not_in_guild');
    }

    // ✅ Session cache — ป้องกัน Discord API ถูกเรียกทุก request (infinite loop)
    const now = Date.now();
    if (req.session?.guildCheckTime && (now - req.session.guildCheckTime) < GUILD_CACHE_TTL) {
        return next(); // ยังอยู่ใน cache window → ผ่านเลย
    }

    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            await new Promise(resolve => req.logout(resolve));
            return isAjax
                ? res.status(401).json({ authenticated: false, error: 'session_invalid', redirect: '/' })
                : res.redirect('/?error=not_in_guild');
        }

        const GuildId = process.env.GUILD_ID?.trim();
        if (!GuildId) return next(); // ไม่มี config → ผ่าน

        // ✅ ใช้ Bot Token ตรวจสอบ (ไม่หมดอายุ ไม่ขึ้นกับ user accessToken)
        const memberData = await checkGuildWithBot(user.discordId);

        // ❌ ออกจาก guild แล้ว — ลบข้อมูล + ไม่ให้เข้า
        if (!memberData) {
            console.log(`[Middleware] ❌ ${user.username} ไม่ได้อยู่ใน guild - กำลังลบข้อมูล...`);
            await User.findByIdAndDelete(user._id);
            await new Promise(resolve => req.logout(resolve));
            return isAjax
                ? res.status(403).json({ authenticated: false, error: 'left_guild', redirect: '/?error=left_guild' })
                : res.redirect('/?error=left_guild');
        }

        const discordRoles = memberData.roles || [];

        // กำหนด role IDs ที่อนุญาต (house roles + admin)
        const allowedRoleIds = [
            process.env.ROLE_GARUDA_ID?.trim(),
            process.env.ROLE_NAGA_ID?.trim(),
            process.env.ROLE_QILIN_ID?.trim(),
            process.env.ROLE_ERAWAN_ID?.trim(),
            process.env.ROLE_ADMIN_ID?.trim(),
        ].filter(Boolean);

        const hasAllowedRole = allowedRoleIds.some(id => discordRoles.includes(id));

        // ❌ อยู่ใน guild แต่ไม่มี role ที่อนุญาต
        if (!hasAllowedRole) {
            console.log(`[Middleware] ❌ ${user.username} ไม่มี role ที่มีสิทธิ์เข้าถึง`);
            await new Promise(resolve => req.logout(resolve));
            return isAjax
                ? res.status(403).json({ authenticated: false, error: 'no_role', redirect: '/?error=no_role' })
                : res.redirect('/?error=no_role');
        }

        // ✅ อัพเดท roles ใน DB ให้ตรงกับ Discord
        const roleMap = {
            [process.env.ROLE_ADMIN_ID?.trim()]: ['admin', 'professor'],
            [process.env.ROLE_GARUDA_ID?.trim()]: ['garuda'],
            [process.env.ROLE_NAGA_ID?.trim()]: ['naga'],
            [process.env.ROLE_QILIN_ID?.trim()]: ['qilin'],
            [process.env.ROLE_ERAWAN_ID?.trim()]: ['erawan'],
        };
        let updatedRoles = ['student'];
        for (const [roleId, roleNames] of Object.entries(roleMap)) {
            if (roleId && discordRoles.includes(roleId)) {
                updatedRoles.push(...roleNames);
            }
        }
        if (JSON.stringify(user.roles?.sort()) !== JSON.stringify(updatedRoles.sort())) {
            user.roles = updatedRoles;
            await user.save();
        }

        console.log(`[Middleware] ✅ ${user.username} ผ่านการตรวจสอบ`);
        // ✅ บันทึกเวลาที่ check สำเร็จ ใน session cache
        req.session.guildCheckTime = Date.now();
        next();

    } catch (err) {
        if (err.message === 'BOT_TOKEN_NOT_CONFIGURED' || err.message === 'GUILD_ID_NOT_CONFIGURED') {
            console.warn('[Middleware] ⚠️ Bot token/Guild ID ยังไม่ได้ตั้งค่า - ข้ามการตรวจสอบ guild');
            return next(); // ไม่ลบข้อมูล แค่ปล่อยผ่าน
        }
        console.error('[Middleware] Error:', err.message);
        req.logout(() => { });
        return isAjax
            ? res.status(500).json({ authenticated: false, error: 'server_error', redirect: '/' })
            : res.redirect('/?error=session_expired');
    }
};

/**
 * @layer L5 — Session
 * Lean detention check — only fetches the 3 detention fields instead of the
 * full User document, reducing per-request payload by ~95%.
 */
const isNotDetained = async (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    try {
        const user = await User.findById(req.user.id)
            .select('isDetained detentionEndDate detentionReason')  // L5: lean — only detention fields
            .lean();                                                  // L5: plain object (no Mongoose overhead)

        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const now = new Date();

        if (user.isDetained && user.detentionEndDate && now < new Date(user.detentionEndDate)) {
            return res.status(403).json({
                message: `You are currently in detention until ${new Date(user.detentionEndDate).toLocaleString('th-TH')}. Reason: ${user.detentionReason || 'Rule violation'}`
            });
        }

        // If detention time has passed, clear it (fire-and-forget — non-blocking)
        if (user.isDetained && user.detentionEndDate && now >= new Date(user.detentionEndDate)) {
            User.findByIdAndUpdate(req.user.id, {
                $set: { isDetained: false, detentionEndDate: null }
            }).catch(e => console.error('[isNotDetained] clear error:', e));
        }

        next();
    } catch (err) {
        res.status(500).json({ message: 'Server error checking detention status.' });
    }
};

module.exports = { isAuthenticated, hasRole, checkGuildMembership, isNotDetained };
