/**
 * Page Lock System — AES-256-GCM Encrypted Content
 * Content is encrypted with the password as key. Dev tools cannot reveal the content.
 * Uses Web Crypto API (SubtleCrypto) for PBKDF2 + AES-GCM decryption.
 */

(function () {
    'use strict';

    const PBKDF2_ITERATIONS = 100000;

    // Initialize lock UI
    function initLock() {
        const encEl = document.getElementById('encrypted-content');
        if (!encEl) return;

        // Build lock overlay
        const overlay = document.createElement('div');
        overlay.className = 'page-lock-overlay';
        overlay.innerHTML = `
            <div class="lock-chain lock-chain-left">⛓⛓⛓⛓⛓⛓</div>
            <div class="lock-chain lock-chain-right">⛓⛓⛓⛓⛓⛓</div>
            <div class="lock-visual">
                <div class="lock-glow"></div>
                <div class="lock-key-icon">🔐</div>
            </div>
            <h2 class="lock-title">${encEl.dataset.lockTitle || 'RESTRICTED ACCESS'}</h2>
            <p class="lock-subtitle">${encEl.dataset.lockSubtitle || 'กรุณาใส่รหัสผ่านเพื่อเข้าถึง'}</p>
            <div class="lock-input-group">
                <input type="password" class="lock-input" placeholder="Password..." id="lockPasswordInput" autocomplete="off">
                <button class="lock-submit" id="lockSubmitBtn">🗝️</button>
            </div>
            <div class="lock-error" id="lockError"></div>
        `;
        document.body.prepend(overlay);
        document.body.style.overflow = 'hidden';

        // Add floating particles
        createParticles();

        // Event listeners
        document.getElementById('lockSubmitBtn').addEventListener('click', attemptUnlock);
        document.getElementById('lockPasswordInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') attemptUnlock();
        });
        document.getElementById('lockPasswordInput').focus();
    }

    async function attemptUnlock() {
        const passwordInput = document.getElementById('lockPasswordInput');
        const errorEl = document.getElementById('lockError');
        const password = passwordInput.value.trim();

        if (!password) {
            errorEl.textContent = 'กรุณากรอกรหัสผ่าน';
            shakeIcon();
            return;
        }

        errorEl.textContent = '';

        try {
            const encryptedData = document.getElementById('encrypted-content').dataset.content;
            const decrypted = await decryptContent(encryptedData, password);

            // Success — unlock the page
            unlockPage(decrypted);
        } catch (e) {
            errorEl.textContent = '🔒 รหัสผ่านไม่ถูกต้อง';
            shakeIcon();
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    async function decryptContent(encryptedData, password) {
        const [saltB64, ivB64, authTagB64, ciphertextB64] = encryptedData.split(':');

        const salt = b64ToUint8(saltB64);
        const iv = b64ToUint8(ivB64);
        const authTag = b64ToUint8(authTagB64);
        const ciphertext = b64ToUint8(ciphertextB64);

        // AES-GCM expects ciphertext + authTag concatenated
        const combined = new Uint8Array(ciphertext.length + authTag.length);
        combined.set(ciphertext);
        combined.set(authTag, ciphertext.length);

        // Derive key from password
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            combined
        );

        return new TextDecoder().decode(decryptedBuffer);
    }

    function unlockPage(htmlContent) {
        const overlay = document.querySelector('.page-lock-overlay');
        const keyIcon = overlay.querySelector('.lock-key-icon');
        const pageContent = document.getElementById('page-content');

        // Animate key turning
        keyIcon.classList.add('unlocking');

        setTimeout(() => {
            overlay.classList.add('unlocked');
            pageContent.innerHTML = htmlContent;
            pageContent.style.display = '';
            document.body.style.overflow = '';

            // Re-run any inline scripts in the decrypted content
            pageContent.querySelectorAll('script').forEach(oldScript => {
                const newScript = document.createElement('script');
                if (oldScript.src) {
                    newScript.src = oldScript.src;
                } else {
                    newScript.textContent = oldScript.textContent;
                }
                oldScript.replaceWith(newScript);
            });

            // Initialize scroll observer for decrypted sections
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) entry.target.classList.add('visible');
                });
            }, { threshold: 0.1 });
            pageContent.querySelectorAll('section').forEach(s => observer.observe(s));

            setTimeout(() => overlay.remove(), 1200);
        }, 800);
    }

    function shakeIcon() {
        const icon = document.querySelector('.lock-key-icon');
        icon.classList.remove('shake');
        void icon.offsetWidth; // trigger reflow
        icon.classList.add('shake');
    }

    function createParticles() {
        const container = document.createElement('div');
        container.className = 'lock-particles';
        document.body.prepend(container);

        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'lock-particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = Math.random() * 100 + '%';
            p.style.animation = `lockParticleDrift ${3 + Math.random() * 4}s ${Math.random() * 3}s ease-in-out infinite`;
            container.appendChild(p);
        }

        // Add keyframe dynamically
        const style = document.createElement('style');
        style.textContent = `
            @keyframes lockParticleDrift {
                0%, 100% { opacity: 0; transform: translateY(0) scale(0.5); }
                50% { opacity: 0.6; transform: translateY(-30px) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    function b64ToUint8(b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLock);
    } else {
        initLock();
    }
})();
