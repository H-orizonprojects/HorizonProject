/**
 * Encrypt Page Content — Node.js utility
 * Usage: node tools/encrypt-page.mjs <html-file> <password>
 * Outputs: Modified HTML file with encrypted body content
 */

import { readFileSync, writeFileSync } from 'fs';
import { randomBytes, createCipheriv, pbkdf2Sync } from 'crypto';
import { resolve } from 'path';

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node tools/encrypt-page.mjs <html-file> <password>');
    process.exit(1);
}

const filePath = resolve(args[0]);
const password = args[1];

console.log(`Encrypting: ${filePath}`);

const html = readFileSync(filePath, 'utf-8');

// Extract the content between <body> tags
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!bodyMatch) {
    console.error('Could not find <body> content');
    process.exit(1);
}

const bodyContent = bodyMatch[1].trim();

// Extract <head> content
const headMatch = html.match(/<head[^>]*>([\s\S]*)<\/head>/i);
const headContent = headMatch ? headMatch[1] : '';

// Extract title
const titleMatch = html.match(/<title>(.*?)<\/title>/i);
const title = titleMatch ? titleMatch[1] : 'Locked Page';

// Extract lock title from the page header (h1)
const h1Match = bodyContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
const lockTitle = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : 'RESTRICTED ACCESS';

// Encrypt the body content
const salt = randomBytes(16);
const iv = randomBytes(12);
const key = pbkdf2Sync(password, salt, 100000, 32, 'sha256');

const cipher = createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(bodyContent, 'utf8');
encrypted = Buffer.concat([encrypted, cipher.final()]);
const authTag = cipher.getAuthTag();

// Format: salt:iv:authTag:ciphertext (all base64)
const encryptedData = `${salt.toString('base64')}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;

// Build locked page HTML
const lockedHtml = `<!DOCTYPE html>
<html lang="th">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/page-lock.css">
    <style>
        /* Minimal page styles loaded with lock — full styles are in encrypted content */
        body { background: #050505; margin: 0; }
    </style>
</head>

<body>
    <!-- Encrypted content — cannot be read without the password -->
    <div id="encrypted-content" 
         data-content="${encryptedData}"
         data-lock-title="${lockTitle}"
         data-lock-subtitle="กรุณาใส่รหัสผ่านเพื่อเข้าถึง"
         style="display:none"></div>

    <!-- Decrypted content will be injected here -->
    <div id="page-content" style="display:none"></div>

    <script src="js/page-lock.js"></script>
</body>

</html>`;

writeFileSync(filePath, lockedHtml, 'utf-8');
console.log(`✅ Encrypted successfully! File updated: ${filePath}`);
console.log(`   Lock title: ${lockTitle}`);
console.log(`   Encrypted data length: ${encryptedData.length} chars`);
