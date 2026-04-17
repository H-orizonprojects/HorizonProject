/**
 * @layer L4 — Transport
 * Middleware for Conditional GET requests using ResourceVersionManager.
 *
 * Pattern:
 * 1. Check if the resource has a version tag.
 * 2. Compare the tag with the client's 'If-None-Match' header.
 * 3. If they match, send 304 Not Modified immediately.
 * 4. Otherwise, proceed to the route handler.
 */

'use strict';

const versionManager = require('../utils/version');

/**
 * Creates a middleware that handles conditional requests for a specific resource.
 * @param {string} resourceName
 */
function conditionalRequest(resourceName) {
    return async (req, res, next) => {
        // Only apply to GET/HEAD requests
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        try {
            const currentVersion = await versionManager.getVersion(resourceName);
            const clientEtag = req.get('If-None-Match');

            // Wrap version in quotes to follow ETag spec (weak or strong)
            const etag = `W/"${currentVersion}"`;

            // Early exit if version matches
            if (clientEtag === etag) {
                console.log(`[Conditional] 304 Short-circuit for ${resourceName} (v${currentVersion})`);
                return res.status(304).end();
            }

            // Store current version for the response if it proceeds
            res.set('ETag', etag);
            next();
        } catch (err) {
            console.error(`[Conditional] Error in middleware for ${resourceName}:`, err);
            next(); // Proceed anyway on error
        }
    };
}

module.exports = conditionalRequest;
