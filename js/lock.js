document.addEventListener('DOMContentLoaded', () => {
    const lockScreen = document.getElementById('lock-screen');
    const lockBtn = document.getElementById('lock-btn');
    const mainContent = document.getElementById('main-content');
    const lockStatus = document.querySelector('.lock-status');
    const chainSvg = document.querySelector('.chain-svg');
    const lockContainer = document.querySelector('.lock-container');

    // Add magical glow effect on page load
    const magicGlow = document.createElement('div');
    magicGlow.className = 'magic-glow';
    lockContainer.appendChild(magicGlow);

    if (lockBtn) {
        lockBtn.addEventListener('click', () => {
            // Prevent multiple clicks
            lockBtn.style.pointerEvents = 'none';

            // Start unlock animation
            lockBtn.classList.add('unlocking');
            chainSvg.classList.add('breaking');
            lockStatus.classList.add('fading');
            magicGlow.classList.add('burst');

            // Create particle burst effect
            createParticleBurst(lockContainer);

            // Create magical ripple effect
            createMagicalRipples(lockContainer);

            setTimeout(() => {
                lockScreen.classList.add('unlocked');
                mainContent.style.filter = "blur(0)";
                mainContent.style.opacity = "1";

                console.log("✨ Eternity Unlocked ✨");
            }, 1200);
        });
    }
});

// Create particle burst animation
function createParticleBurst(container) {
    const particleCount = 40;
    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        // Random angle and distance
        const angle = (Math.PI * 2 * i) / particleCount;
        const distance = 100 + Math.random() * 150;
        const duration = 800 + Math.random() * 400;
        const size = 2 + Math.random() * 4;

        // Random color variation (gold to purple)
        const isGold = Math.random() > 0.3;
        const color = isGold ? '#d4af37' : '#8a2be2';

        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.background = color;
        particle.style.boxShadow = `0 0 10px ${color}, 0 0 20px ${color}`;

        container.appendChild(particle);

        // Animate particle
        const endX = centerX + Math.cos(angle) * distance;
        const endY = centerY + Math.sin(angle) * distance;

        particle.animate([
            {
                transform: 'translate(0, 0) scale(1)',
                opacity: 1
            },
            {
                transform: `translate(${endX - centerX}px, ${endY - centerY}px) scale(0)`,
                opacity: 0
            }
        ], {
            duration: duration,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });

        // Remove particle after animation
        setTimeout(() => particle.remove(), duration);
    }
}

// Create magical ripple effects
function createMagicalRipples(container) {
    const rippleCount = 3;

    for (let i = 0; i < rippleCount; i++) {
        setTimeout(() => {
            const ripple = document.createElement('div');
            ripple.style.position = 'absolute';
            ripple.style.top = '50%';
            ripple.style.left = '50%';
            ripple.style.transform = 'translate(-50%, -50%)';
            ripple.style.width = '50px';
            ripple.style.height = '50px';
            ripple.style.border = '2px solid';
            ripple.style.borderColor = i % 2 === 0 ? '#d4af37' : '#8a2be2';
            ripple.style.borderRadius = '50%';
            ripple.style.opacity = '0.8';
            ripple.style.pointerEvents = 'none';

            container.appendChild(ripple);

            ripple.animate([
                {
                    width: '50px',
                    height: '50px',
                    opacity: 0.8,
                    boxShadow: '0 0 20px currentColor'
                },
                {
                    width: '400px',
                    height: '400px',
                    opacity: 0,
                    boxShadow: '0 0 60px currentColor'
                }
            ], {
                duration: 1200,
                easing: 'ease-out'
            });

            setTimeout(() => ripple.remove(), 1200);
        }, i * 200);
    }
}
