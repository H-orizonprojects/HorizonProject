// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
};

// Middleware to check if user has specific role
const hasRole = (roles) => {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Check if user has any of the required roles
        // This logic depends on how roles are stored (IDs or Names)
        // For now assuming roles stored as IDs match .env config
        const userRoles = req.user.roles || [];
        const hasPermission = roles.some(role => userRoles.includes(role));

        if (hasPermission || req.user.roles.includes('admin')) {
            return next();
        }

        res.status(403).json({ message: 'Forbidden' });
    }
};

module.exports = { isAuthenticated, hasRole };
