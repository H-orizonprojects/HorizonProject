// js/classroom.js

let user = null;
let currentRoom = 'potion'; // default
let shopSeeds = [];
let userInventory = [];

// DOM Elements
const userGoldEl = document.getElementById('userGold');

// Init
async function initClassroom() {
    try {
        const res = await fetch('/auth/me', { credentials: 'include' });
        if (!res.ok) {
            window.location.href = '/?error=not_logged_in';
            return;
        }
        const authData = await res.json();
        if (!authData.authenticated || !authData.user) {
            window.location.href = '/?error=not_logged_in';
            return;
        }
        user = authData.user;

        userGoldEl.textContent = user.balance;

        // Show Admin Logs tab if admin/professor
        if (user.roles?.includes('admin') || user.roles?.includes('professor')) {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        }

        renderInventoryPanel();
        initThreeJS();
        switchClassroomTab('potion');

    } catch (err) {
        console.error('Init error:', err);
    }
}

// ----------------------------------------------------
//  TAB SWITCHING
// ----------------------------------------------------
async function renderInventoryPanel() {
    const container = document.getElementById('classroomSidebarInventory');
    if (!container) return;

    container.innerHTML = '<p style="color:#a89070; text-align:center;">Loading...</p>';

    // Reuse already-loaded user object (avoid extra /auth/me call)
    const inv = user?.inventory || [];
    container.innerHTML = '';

    if (inv.length === 0) {
        container.innerHTML = '<p style="color:#777; font-size: 0.8rem; text-align:center;">กระเป๋าว่างเปล่า</p>';
        return;
    }

    inv.forEach(slot => {
        if (!slot.itemId || slot.quantity <= 0) return;

        let item = slot.itemId;
        let img = 'assets/images/item.png';
        let name = 'Unknown Item';

        if (typeof item === 'object') {
            img = item.image || img;
            name = item.name || name;
        }

        const div = document.createElement('div');
        div.className = 'inv-small-item';
        div.innerHTML = `
            <img src="${img}" alt="${name}" loading="lazy">
            <div class="inv-small-qty">x${slot.quantity}</div>
            <div class="inv-small-tooltip">${name}</div>
        `;
        container.appendChild(div);
    });
}

function switchClassroomTab(room) {
    currentRoom = room;
    // Update nav buttons
    document.querySelectorAll('.spell-nav .spell-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick')?.includes(room)) {
            btn.classList.add('active');
        }
    });

    // Update section display
    document.querySelectorAll('.room-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`room-${room}`).classList.add('active');

    if (room === 'potion') loadPotions();
    else if (room === 'herbology') {
        loadHerbPlots();
        loadShopCategory('seed', document.querySelector('.shop-tab.active'));
    }
    else if (room === 'charms') loadCharms();
    else if (room === 'admin_logs') loadAdminLogs(1);
}

// ----------------------------------------------------
//  THREE.JS BACKGROUND
// ----------------------------------------------------
function initThreeJS() {
    const canvas = document.getElementById('magicBgCanvas');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a050f, 0.02);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, logarithmicDepthBuffer: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.position.z = 25;

    // --- Dynamic Lighting ---
    const ambientLight = new THREE.AmbientLight(0x221133, 1.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xd4af37, 2, 50);
    pointLight.position.set(0, 5, 10);
    scene.add(pointLight);

    // --- Particles ---
    const particleCount = 1500;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 80;
        positions[i + 1] = (Math.random() - 0.5) * 80;
        positions[i + 2] = (Math.random() - 0.5) * 40 - 10;
        velocities.push({
            y: Math.random() * 0.02 + 0.01,
            x: (Math.random() - 0.5) * 0.01
        });
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Create a circular texture for particles programmatically
    const canvasPoint = document.createElement('canvas');
    canvasPoint.width = 16;
    canvasPoint.height = 16;
    const contextPoint = canvasPoint.getContext('2d');
    const gradientPoint = contextPoint.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradientPoint.addColorStop(0, 'rgba(255,255,255,1)');
    gradientPoint.addColorStop(1, 'rgba(255,255,255,0)');
    contextPoint.fillStyle = gradientPoint;
    contextPoint.fillRect(0, 0, 16, 16);
    const particleTexture = new THREE.CanvasTexture(canvasPoint);

    const pMaterial = new THREE.PointsMaterial({
        color: 0xd4af37,
        size: 0.6,
        map: particleTexture,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(particles, pMaterial);
    scene.add(particleSystem);

    // --- Floating 3D Objects (Crystals/Runes) ---
    const floatingObjects = new THREE.Group();
    const geoTypes = [
        new THREE.OctahedronGeometry(1, 0),
        new THREE.DodecahedronGeometry(0.8, 0),
        new THREE.TetrahedronGeometry(1.2, 0)
    ];

    const objMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x4a1c6a,
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.8,
        wireframe: true,
        transparent: true,
        opacity: 0.6
    });

    for (let i = 0; i < 15; i++) {
        const mesh = new THREE.Mesh(geoTypes[Math.floor(Math.random() * geoTypes.length)], objMaterial.clone());
        mesh.position.set(
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 15 - 10
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        // Custom properties for animation
        mesh.userData = {
            rotSpeedX: (Math.random() - 0.5) * 0.02,
            rotSpeedY: (Math.random() - 0.5) * 0.02,
            floatSpeed: Math.random() * 0.02 + 0.01,
            startY: mesh.position.y,
            offset: Math.random() * Math.PI * 2
        };
        floatingObjects.add(mesh);
    }
    scene.add(floatingObjects);

    // --- Mouse Interaction ---
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX - windowHalfX) * 0.05;
        mouseY = (event.clientY - windowHalfY) * 0.05;
    });

    // --- Animation Loop ---
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.01;

        // Mouse paralax
        targetX = mouseX * 0.1;
        targetY = mouseY * 0.1;
        camera.position.x += (targetX - camera.position.x) * 0.05;
        camera.position.y += (-targetY - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        // Update particles slowly moving up
        const positionsArr = particleSystem.geometry.attributes.position.array;
        for (let i = 0, j = 0; i < particleCount; i++, j += 3) {
            positionsArr[j + 1] += velocities[i].y;
            positionsArr[j] += velocities[i].x;
            if (positionsArr[j + 1] > 40) {
                positionsArr[j + 1] = -40;
                positionsArr[j] = (Math.random() - 0.5) * 80;
            }
        }
        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.rotation.y = time * 0.05;

        // Animate Floating Objects
        floatingObjects.children.forEach(mesh => {
            mesh.rotation.x += mesh.userData.rotSpeedX;
            mesh.rotation.y += mesh.userData.rotSpeedY;
            mesh.position.y = mesh.userData.startY + Math.sin(time + mesh.userData.offset) * 2;

            // Sync colors with room
            if (currentRoom === 'potion') mesh.material.emissive.setHex(0x6a1c4a);
            else if (currentRoom === 'herbology') mesh.material.emissive.setHex(0x1c6a2e);
            else if (currentRoom === 'charms') mesh.material.emissive.setHex(0x1c4a6a);
            else mesh.material.emissive.setHex(0x6a541c);
        });

        // Change light and particle color based on room
        const colorTarget = new THREE.Color();
        if (currentRoom === 'potion') colorTarget.setHex(0xc882e8);
        else if (currentRoom === 'herbology') colorTarget.setHex(0x8af58a);
        else if (currentRoom === 'charms') colorTarget.setHex(0x8ab4f8);
        else colorTarget.setHex(0xd4af37);

        pMaterial.color.lerp(colorTarget, 0.05);
        pointLight.color.lerp(colorTarget, 0.05);

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// ----------------------------------------------------
//  POTION ROOM
// ----------------------------------------------------
// ----------------------------------------------------
//  POTION ROOM (Interactive Minigame)
// ----------------------------------------------------
const POTION_RECIPES = [
    {
        name: 'Polyjuice Potion',
        desc: 'Allows the drinker to assume the form of someone else.',
        img: 'assets/images/potions/Polyjuice_Potion.png',
        reqs: ['Fluxweed', 'Knotgrass', 'Lacewing Flies', 'Horn of Bicorn'],
        gesture: 'circle'
    },
    {
        name: 'Veritaserum',
        desc: 'A powerful truth serum.',
        img: 'assets/images/potions/Veritaserum.png',
        reqs: ['Jobberknoll Feather', 'Syrup of Hellebore'],
        gesture: 'straight'
    },
    {
        name: 'Felix Felicis',
        desc: 'Liquid luck. Makes the drinker successful in all their endeavours.',
        img: 'assets/images/potions/Felix_Felicis.png',
        reqs: ['Ashwinder Egg', 'Squill Bulb', 'Murtlap Tentacle'],
        gesture: 'zigzag'
    },
    {
        name: 'Amortentia Potion',
        desc: 'The most powerful love potion in the world.',
        img: 'assets/images/potions/Amortentia.png',
        reqs: ['Pearl Dust', 'Rose Petals', 'Peppermint'],
        gesture: 'heart'
    },
    {
        name: 'Wolfsbane Potion',
        desc: 'Relieves, but does not cure, the symptoms of lycanthropy.',
        img: 'assets/images/potions/Wolfsbane_Potion.png',
        reqs: ['Wolfsbane'],
        gesture: 'straight'
    }
];

let activeBrew = null;
let pCanvas, pCtx;
let pDrawing = false;
let pPath = [];

function loadPotions() {
    const listContainer = document.getElementById('potionListContainer');
    listContainer.innerHTML = '';

    POTION_RECIPES.forEach((potion) => {
        const card = document.createElement('div');
        card.className = 'potion-card';
        card.innerHTML = `
            <div class="potion-img-wrap"><img src="${potion.img}" alt="Potion" loading="lazy"></div>
            <div class="potion-details">
                <h3 class="potion-name">${potion.name}</h3>
                <p style="font-size: 0.8rem; color: #a89070; margin-bottom: 0.8rem;">${potion.desc}</p>
                <div class="potion-reqs" style="margin-bottom:0.5rem;">
                    ${potion.reqs.map(r => `<span class="req-badge">${r}</span>`).join('')}
                </div>
                <button class="brew-btn" onclick="startBrewing('${potion.name}')">Start Brewing</button>
            </div>
        `;
        listContainer.appendChild(card);
    });

    initPotionCanvas();
}

function initPotionCanvas() {
    if (pCanvas) return;
    pCanvas = document.getElementById('potionCanvas');
    if (!pCanvas) return;
    pCtx = pCanvas.getContext('2d');

    pCanvas.addEventListener('mousedown', startPDraw);
    pCanvas.addEventListener('mousemove', pDraw);
    pCanvas.addEventListener('mouseup', endPDraw);

    // Touch
    pCanvas.addEventListener('touchstart', e => { e.preventDefault(); startPDraw(e.touches[0]); }, { passive: false });
    pCanvas.addEventListener('touchmove', e => { e.preventDefault(); pDraw(e.touches[0]); }, { passive: false });
    pCanvas.addEventListener('touchend', e => { e.preventDefault(); endPDraw(); }, { passive: false });
}

function startBrewing(potionName) {
    const recipe = POTION_RECIPES.find(r => r.name === potionName);
    activeBrew = {
        recipe,
        added: [],
        step: 0,
        waitingForGesture: false
    };

    // Update UI
    document.getElementById('brewingStatus').innerHTML = `Brewing: <span style="color:#d4af37;">${potionName}</span>`;
    document.getElementById('potionStepStatus').innerHTML = `Step 1: Add <span style="color:#f0c8f0;">${recipe.reqs[0]}</span>`;
    document.getElementById('resetBrewBtn').style.display = 'block';
    document.getElementById('finishBrewBtn').style.display = 'none';
    document.getElementById('potionCanvasContainer').style.display = 'none';
    document.getElementById('droppedIngredients').innerHTML = '';

    // Setup Stash
    setupIngredientStash(recipe);
    setupDropZone();
}

function setupIngredientStash(recipe) {
    const stash = document.getElementById('ingredientStash');
    stash.innerHTML = '';

    // For Roleplay/Demo, we provide the ingredients even if not in inv (as per previous logic), 
    // but marked with quantity if we want to be fancy.
    // Let's just provide the recipe ingredients for dragging.
    recipe.reqs.forEach(ingName => {
        const div = document.createElement('div');
        div.className = 'draggable-ing';
        div.draggable = true;
        div.innerHTML = `
            <img src="assets/images/item.png" alt="${ingName}">
            <span class="name">${ingName}</span>
        `;
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', ingName);
            div.classList.add('dragging');
        });
        div.addEventListener('dragend', () => div.classList.remove('dragging'));
        stash.appendChild(div);
    });
}

function setupDropZone() {
    const zone = document.getElementById('cauldronDropZone');

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drop-hover');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drop-hover');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drop-hover');
        const ingName = e.dataTransfer.getData('text/plain');
        handleIngDrop(ingName);
    });
}

function handleIngDrop(ingName) {
    if (!activeBrew || activeBrew.waitingForGesture) return;

    const expected = activeBrew.recipe.reqs[activeBrew.step];

    // Visual feedback for drop
    const dropFeedback = document.createElement('div');
    dropFeedback.className = 'dropped-item';
    dropFeedback.innerHTML = `<img src="assets/images/item.png" style="width:100%; height:100%;">`;
    // Random position around cauldron
    dropFeedback.style.left = (50 + (Math.random() - 0.5) * 40) + '%';
    dropFeedback.style.top = '100px';
    document.getElementById('droppedIngredients').appendChild(dropFeedback);
    setTimeout(() => dropFeedback.remove(), 1000);

    if (ingName === expected) {
        activeBrew.added.push(ingName);
        activeBrew.step++;

        if (activeBrew.step >= activeBrew.recipe.reqs.length) {
            // All ingredients added, now the wand wave
            activeBrew.waitingForGesture = true;
            showWandGestureStep();
        } else {
            const next = activeBrew.recipe.reqs[activeBrew.step];
            document.getElementById('potionStepStatus').innerHTML = `Correct! Next: <span style="color:#f0c8f0;">${next}</span>`;

            // Cauldron glow effect
            document.getElementById('cauldronImg').style.filter = 'drop-shadow(0 0 30px rgba(200, 130, 232, 0.8))';
            setTimeout(() => {
                document.getElementById('cauldronImg').style.filter = 'drop-shadow(0 0 20px rgba(200, 100, 200, 0.3))';
            }, 500);
        }
    } else {
        document.getElementById('potionStepStatus').innerHTML = `<span style="color:#f56a6a;">Wrong ingredient!</span> Try ${expected}`;
        // Smoke effect or similar?
        document.getElementById('cauldronImg').style.filter = 'drop-shadow(0 0 40px rgba(255, 100, 100, 0.8))';
    }
}

function showWandGestureStep() {
    document.getElementById('potionStepStatus').innerHTML = `<span style="color:#6af56a; font-weight:bold;">Ingredients complete!</span> Perform the final gesture.`;
    document.getElementById('potionCanvasContainer').style.display = 'block';

    const gesture = activeBrew.recipe.gesture || 'circle';
    let hint = 'Draw a circle to stir';
    if (gesture === 'straight') hint = 'Flick upwards';
    if (gesture === 'zigzag') hint = 'Draw a zigzag';
    if (gesture === 'heart') hint = 'Draw a heart shape';

    document.getElementById('potionGestureHint').textContent = hint;

    // Clear sub-canvas
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
}

function resetBrewMinigame() {
    if (activeBrew) startBrewing(activeBrew.recipe.name);
}

// Sub-canvas drawing
function startPDraw(e) {
    if (!activeBrew || !activeBrew.waitingForGesture) return;
    pDrawing = true;
    pPath = [];
    const rect = pCanvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;
    pPath.push({ x, y });
    pCtx.beginPath();
    pCtx.moveTo(x, y);
}

function pDraw(e) {
    if (!pDrawing) return;
    const rect = pCanvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;
    pPath.push({ x, y });

    pCtx.lineTo(x, y);
    pCtx.strokeStyle = '#c882e8';
    pCtx.lineWidth = 3;
    pCtx.stroke();
}

function endPDraw() {
    if (!pDrawing) return;
    pDrawing = false;

    if (pPath.length > 10) {
        document.getElementById('finishBrewBtn').style.display = 'block';
    }
}

async function finishBrewMinigame() {
    if (!activeBrew) return;

    const status = document.getElementById('brewingStatus');
    const stepStatus = document.getElementById('potionStepStatus');

    status.innerHTML = `Finishing <span style="color:#d4af37;">${activeBrew.recipe.name}</span>...`;

    // Simulated gesture check
    const success = pPath.length > 20; // Simplified for demo

    try {
        const res = await fetch('/api/classroom/potion/brew', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ potionName: activeBrew.recipe.name })
        });
        const data = await res.json();

        if (success) {
            document.getElementById('cauldronImg').style.filter = 'drop-shadow(0 0 50px rgba(106, 245, 106, 0.9))';
            status.innerHTML = `✨ Successfully brewed <span style="color:#d4af37;">${activeBrew.recipe.name}</span>!`;
            status.style.color = '#6af56a';
            stepStatus.innerHTML = 'Exceptional work, Wizard.';
            showToast(data.message, 'success');
        } else {
            document.getElementById('cauldronImg').style.filter = 'drop-shadow(0 0 50px rgba(255, 100, 100, 0.9))';
            status.innerHTML = `💨 Brewing failed!`;
            status.style.color = '#f56a6a';
            stepStatus.innerHTML = 'Your wand movement was imprecise.';
            showToast('The potion turned into black smoke...', 'error');
        }
    } catch (err) {
        console.error(err);
    }

    document.getElementById('finishBrewBtn').style.display = 'none';
    document.getElementById('potionCanvasContainer').style.display = 'none';
}


// ----------------------------------------------------
//  HERBOLOGY ROOM
// ----------------------------------------------------
let currentPlantSlot = -1;

async function loadHerbPlots() {
    try {
        const res = await fetch('/api/classroom/herbs/me', { credentials: 'include' });
        const plots = await res.json();
        const container = document.getElementById('herbPlotsContainer');
        container.innerHTML = '';

        for (let i = 0; i < 6; i++) {
            const plotData = plots.find(p => p.slot === i && !p.isHarvested);
            const div = document.createElement('div');
            div.className = 'herb-plot';

            if (!plotData) {
                // Empty Plot
                div.innerHTML = `
                    <div class="plot-empty"></div>
                    <div class="plot-name" style="color:#a89070;">Empty Plot ${i + 1}</div>
                    <div class="plot-status">Ready for planting</div>
                    <div class="plot-actions">
                        <button class="plot-btn" onclick="openPlantModal(${i})">Plant Seed</button>
                    </div>
                `;
            } else {
                // Occupied Plot
                const img = plotData.image || 'assets/images/item.png';
                const name = plotData.seedName || 'Unknown Plant';

                let btnHtml = '';
                let statusHtml = '';

                if (plotData.isReady) {
                    statusHtml = '<span style="color:#6af56a; font-weight:bold;">Ready to harvest!</span>';
                    btnHtml = `<button class="plot-btn harvest" onclick="harvestPlant(${i})">Harvest</button>`;
                } else {
                    const now = new Date();
                    const lastWatered = new Date(plotData.lastWateredAt);
                    const hoursSinceWater = (now - lastWatered) / 3600000;
                    const cooldown = plotData.waterIntervalHours * 0.5;

                    const harvestTime = new Date(plotData.harvestAt);
                    const hoursLeft = Math.max(0, (harvestTime - now) / 3600000).toFixed(1);

                    statusHtml = `Growing... <span style="color:#d4af37; font-weight:bold;">${hoursLeft}h</span> left`;

                    if (hoursSinceWater >= cooldown) {
                        btnHtml = `<button class="plot-btn water" onclick="waterPlant(${i})">Water</button>`;
                    } else {
                        const waitHours = (cooldown - hoursSinceWater).toFixed(1);
                        btnHtml = `<button class="plot-btn water" disabled title="Water in ${waitHours}h">Water (${waitHours}h)</button>`;
                    }
                }

                div.innerHTML = `
                    <img src="${img}" class="plot-img" alt="${name}" loading="lazy">
                    <div class="plot-name">${name}</div>
                    <div class="plot-status">${statusHtml}</div>
                    <div class="plot-actions">${btnHtml}</div>
                `;

                // Add minor glow if ready
                if (plotData.isReady) {
                    div.style.borderColor = '#6af56a';
                    div.style.boxShadow = '0 0 15px rgba(106, 245, 106, 0.2)';
                }
            }
            container.appendChild(div);
        }
    } catch (err) {
        console.error('Failed to load plots', err);
    }
}

let currentShopCategory = 'seed';
let allShopItems = [];

async function loadShopCategory(category, btnEl) {
    if (btnEl) {
        document.querySelectorAll('.shop-tab').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
    }

    currentShopCategory = category;

    try {
        const res = await fetch(`/api/shop/items?type=${category}&limit=50`, { credentials: 'include' });
        const data = await res.json();
        allShopItems = data.items || [];
        filterShopItems(); // Re-render with any existing search
    } catch (err) {
        console.error('Failed to load shop items', err);
    }
}

function filterShopItems() {
    const searchVal = document.getElementById('shopSearchFilter').value.toLowerCase();
    const container = document.getElementById('seedShopContainer');
    container.innerHTML = '';

    const filtered = allShopItems.filter(item => item.name.toLowerCase().includes(searchVal));

    if (filtered.length === 0) {
        container.innerHTML = '<p style="color:#a89070; text-align:center;">No items found.</p>';
        return;
    }

    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'seed-item';

        // Show grow time for seeds, nothing for regular food/equip (or describe effects)
        let extraInfo = '';
        if (item.type === 'seed') extraInfo = `Grow Time: ${item.effects?.growHours || 48}h`;
        else if (item.description) extraInfo = `<span style="font-size:0.65rem; color:#888;">${item.description.slice(0, 30)}...</span>`;

        div.innerHTML = `
            <img src="${item.image || 'assets/images/item.png'}" alt="${item.name}" loading="lazy">
            <div class="seed-info">
                <div class="seed-name">${item.name}</div>
                <div class="seed-time">${extraInfo}</div>
            </div>
            <button class="buy-seed-btn" onclick="buySeed('${item._id}', ${item.price}, '${item.name}')">Buy (${item.price} 🪙)</button>
        `;
        container.appendChild(div);
    });
}

async function buySeed(itemId, price, name) {
    if (user.balance < price) {
        return showToast('Not enough Galleons!', 'error');
    }

    try {
        const res = await fetch('/api/shop/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ itemId, quantity: 1 })
        });
        const data = await res.json();
        if (res.ok) {
            user.balance = data.balance;
            userGoldEl.textContent = user.balance;
            // update user inv
            user.inventory = data.inventory;
            renderInventoryPanel(); // Refresh sidebar inventory!
            showToast(`Purchased ${name} for ${price} 🪙!`, 'success');
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Purchase failed', 'error');
    }
}

async function openPlantModal(slot) {
    currentPlantSlot = slot;
    const modal = document.getElementById('plantModal');
    const container = document.getElementById('inventorySeedsContainer');
    container.innerHTML = '<p style="color:#a89070; text-align:center;">Loading inventory...</p>';
    modal.classList.add('active');

    // Reuse already-loaded user inventory (avoid extra /auth/me call)
    userInventory = user.inventory || [];

    container.innerHTML = '';

    // Filter inventory for seeds // checking if itemId is populated
    const seedsInInv = userInventory.filter(i => {
        if (!i.itemId) return false;
        // If it's populated, it's an object with .type
        if (typeof i.itemId === 'object') return i.itemId.type === 'seed' && i.quantity > 0;
        return false;
    });

    if (seedsInInv.length === 0) {
        container.innerHTML = `<p style="color:#f56a6a; text-align:center; margin-top: 1rem;">You don't have any seeds! Buy some from The Spore & Seed shop panel.</p>`;
    } else {
        seedsInInv.forEach(invItem => {
            const item = invItem.itemId;
            const div = document.createElement('div');
            div.style = 'display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.5); padding: 0.8rem; border-radius: 8px; border: 1px solid #554433;';
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap: 1rem;">
                    <img src="${item.image || 'assets/images/item.png'}" loading="lazy" style="width:32px; height:32px;">
                    <div>
                        <div style="color:#d4af37; font-size: 0.9rem; font-family:'Cinzel', serif;">${item.name}</div>
                        <div style="color:#a89070; font-size: 0.75rem;">Owned: ${invItem.quantity}</div>
                    </div>
                </div>
                <button class="plot-btn harvest" onclick="submitPlant('${item._id}')">Plant</button>
            `;
            container.appendChild(div);
        });
    }

    modal.classList.add('active');
}

function closePlantModal() {
    document.getElementById('plantModal').classList.remove('active');
}

async function submitPlant(seedItemId) {
    try {
        const res = await fetch('/api/classroom/herbs/plant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ slot: currentPlantSlot, seedItemId })
        });
        const data = await res.json();
        if (res.ok) {
            closePlantModal();
            showToast(data.message, 'success');
            loadHerbPlots();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Planting failed', 'error');
    }
}

async function waterPlant(slot) {
    try {
        const res = await fetch('/api/classroom/herbs/water', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ slot })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            loadHerbPlots();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Watering failed', 'error');
    }
}

async function harvestPlant(slot) {
    try {
        const res = await fetch('/api/classroom/herbs/harvest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ slot })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            loadHerbPlots();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Harvest failed', 'error');
    }
}

// ----------------------------------------------------
//  CHARMS ROOM (Canvas & Gesture Recognition)
// ----------------------------------------------------
const SPELLS = [
    { id: 'lumos', name: 'Lumos', patternDesc: 'Flick your wand upward in a single swift stroke.' },
    { id: 'nox', name: 'Nox', patternDesc: 'A short downward flick to extinguish the light.' },
    { id: 'wingardium', name: 'Wingardium Leviosa', patternDesc: 'Swish to the right with a gentle lift — swish and flick!' },
    { id: 'accio', name: 'Accio', patternDesc: 'Draw a downward beckoning curve toward you.' },
    { id: 'expecto', name: 'Expecto Patronum', patternDesc: 'Draw a large circular motion — channel your happiest memory.' },
    { id: 'expelliarmus', name: 'Expelliarmus', patternDesc: 'A wide horizontal slash to disarm your opponent.' },
    { id: 'confundo', name: 'Confundo', patternDesc: 'Draw overlapping loops to confuse the target.' },
    { id: 'imperio', name: 'Imperio', patternDesc: 'A long horizontal sweep, ending with a dip downward.' },
];

const PRACTICE_SPELLS = [
    { name: 'Piertotum Locomotor', display: 'P_ert_tum Locomo_or' },
    { name: 'Locomotor Mortis', display: 'Locomo_or Mor_is' },
    { name: 'Petrificus Totalus', display: 'Petri_icus Tot_lus' },
    { name: 'Arania Exumai', display: 'Ara_ia Exu_ai' },
    { name: 'Vera Verto', display: 'Ve_a Ve_to' },
    { name: 'Homenum Revelio', display: 'Home_um Reve_io' },
    { name: 'Meteolojinx Recanto', display: 'Meteo_ojinx Reca_to' },
    { name: 'Protego Totalum', display: 'Prote_o Tota_um' },
    { name: 'Salvavio Hexia', display: 'Salva_io He_ia' },
    { name: 'Aparecium', display: '_pare__um' }
];

let activeSpell = null;
let canvas, ctx;
let drawing = false;
let path = [];

function loadCharms() {
    const listContainer = document.getElementById('spellListContainer');
    listContainer.innerHTML = '';

    SPELLS.forEach(spell => {
        const btn = document.createElement('button');
        btn.className = 'charm-btn';
        if (activeSpell === spell.id) btn.classList.add('active');
        btn.textContent = spell.name;
        btn.onclick = () => selectSpell(spell.id, btn);
        listContainer.appendChild(btn);
    });

    renderCharmsPractice();

    if (!canvas) {
        canvas = document.getElementById('spellCanvas');
        ctx = canvas.getContext('2d');

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDraw);
        canvas.addEventListener('mouseout', endDraw);

        // Touch supports
        canvas.addEventListener('touchstart', e => { e.preventDefault(); startDraw(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchmove', e => { e.preventDefault(); draw(e.touches[0]); }, { passive: false });
        canvas.addEventListener('touchend', e => { e.preventDefault(); endDraw(); }, { passive: false });

        document.getElementById('clearCanvasBtn').onclick = clearCanvas;
        document.getElementById('castSpellBtn').onclick = submitCastSpell;
    }

    // Clear canvas and reset state on load
    clearCanvas();
}

function selectSpell(id, btnEl) {
    activeSpell = id;
    document.querySelectorAll('.charm-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');

    const spell = SPELLS.find(s => s.id === id);
    const resultDisplay = document.getElementById('charmResultDisplay');
    resultDisplay.style.color = '#8ab4f8';
    resultDisplay.textContent = spell.patternDesc;

    document.getElementById('castSpellBtn').disabled = true;
    clearCanvas();
}

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function startDraw(e) {
    if (!activeSpell) return;
    drawing = true;
    path = [];
    const pos = getPos(e);
    path.push(pos);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    // Sparkle effect at start
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#6ab0f5';
}

function draw(e) {
    if (!drawing) return;
    const pos = getPos(e);
    path.push(pos);

    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#a8cdef';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Create a particle occasionally along the path (pure JS canvas effect)
    if (Math.random() < 0.1) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(pos.x + (Math.random() - 0.5) * 10, pos.y + (Math.random() - 0.5) * 10, Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath(); // Reset path for drawing line
        ctx.moveTo(pos.x, pos.y);
    }
}

function endDraw() {
    if (!drawing) return;
    drawing = false;
    ctx.shadowBlur = 0;

    if (path.length > 5) {
        document.getElementById('castSpellBtn').disabled = false;
    }
}

function clearCanvas() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    path = [];
    document.getElementById('castSpellBtn').disabled = true;

    if (activeSpell) {
        const spell = SPELLS.find(s => s.id === activeSpell);
        const resultDisplay = document.getElementById('charmResultDisplay');
        resultDisplay.style.color = '#8ab4f8';
        resultDisplay.textContent = spell.patternDesc;
    }
}

async function submitCastSpell() {
    if (!activeSpell || path.length < 5) return;

    const spell = SPELLS.find(s => s.id === activeSpell);

    // VERY simple fake gesture recognition logic for fun roleplay
    // We just check overall direction or complexity, but mostly allow it to succeed if they drew enough
    let success = false;

    const startX = path[0].x;
    const endX = path[path.length - 1].x;
    const startY = path[0].y;
    const endY = path[path.length - 1].y;
    const dx = endX - startX;
    const dy = endY - startY;

    if (activeSpell === 'lumos') {
        success = (dy < -50 && Math.abs(dx) < 100); // mostly up
    } else if (activeSpell === 'nox') {
        success = (dy > 30 && path.length < 30 && Math.abs(dx) < 80); // short flick down
    } else if (activeSpell === 'wingardium') {
        success = (dx > 50 && path.length > 10); // curve right and down/up
    } else if (activeSpell === 'accio') {
        success = (dy > 50 && path.length > 10); // curve down
    } else if (activeSpell === 'expecto') {
        success = (path.length > 30); // Needs a long path (circle)
    } else if (activeSpell === 'expelliarmus') {
        success = (Math.abs(dx) > 50 && path.length > 15); // Zigzag needs length
    } else if (activeSpell === 'confundo') {
        // Overlapping circles: path is long & end point close to start
        const distFromStart = Math.sqrt(dx * dx + dy * dy);
        success = (path.length > 40 && distFromStart < 80); // looping path
    } else if (activeSpell === 'imperio') {
        // Long horizontal stroke then slight dip
        success = (Math.abs(dx) > 80 && dy > 10 && dy < 80 && path.length > 15);
    }

    // Add small random chance to fail even if pattern roughly matches for realism
    if (success && Math.random() < 0.1) success = false;
    if (!success && Math.random() < 0.2) success = true; // small chance to succeed anyway

    const resultDisplay = document.getElementById('charmResultDisplay');

    try {
        const res = await fetch('/api/classroom/charms/cast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ charmName: spell.name, success })
        });
        const data = await res.json();

        if (data.success) {
            resultDisplay.style.color = '#6af56a';
            resultDisplay.innerHTML = `✨ ${data.message}`;

            // Canvas flash effect
            ctx.fillStyle = 'rgba(106, 245, 106, 0.4)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            setTimeout(clearCanvas, 800);
        } else {
            resultDisplay.style.color = '#f56a6a';
            resultDisplay.innerHTML = `💨 ${data.message}`;

            // Canvas red flash effect
            ctx.fillStyle = 'rgba(245, 106, 106, 0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            setTimeout(clearCanvas, 800);
        }
    } catch (err) {
        console.error('Charm casting failed', err);
    }
}

function renderCharmsPractice() {
    const container = document.getElementById('charmsPracticeContainer');
    if (!container) return;
    container.innerHTML = '';

    PRACTICE_SPELLS.forEach((spell, index) => {
        const card = document.createElement('div');
        card.className = 'practice-card';
        card.innerHTML = `
            <div class="practice-cloze">${spell.display}</div>
            <div class="practice-input-wrap">
                <input type="text" 
                       class="practice-input" 
                       placeholder="Type incantation..." 
                       onkeyup="if(event.key==='Enter') checkPracticeAnswer(${index}, this.value, this)"
                       oninput="this.classList.remove('wrong', 'correct')">
                <div class="practice-feedback"></div>
            </div>
        `;
        container.appendChild(card);
    });
}

function checkPracticeAnswer(index, value, inputEl) {
    const spell = PRACTICE_SPELLS[index];
    const feedback = inputEl.nextElementSibling;

    if (value.trim().toLowerCase() === spell.name.toLowerCase()) {
        inputEl.classList.remove('wrong');
        inputEl.classList.add('correct');
        feedback.style.color = '#6af56a';
        feedback.textContent = '✨ Perfect Cast!';

        // Success sparkle effect (minimal)
        const rect = inputEl.getBoundingClientRect();
        showToast(`Advanced Incantation Mastered: ${spell.name}`, 'success');
    } else {
        inputEl.classList.remove('correct');
        inputEl.classList.add('wrong');
        feedback.style.color = '#f56a6a';
        feedback.textContent = '💨 Not quite right...';
    }
}

// ----------------------------------------------------
//  ADMIN LOGS
// ----------------------------------------------------
let currentLogPage = 1;

async function loadAdminLogs(page = 1) {
    if (!user || (!user.roles?.includes('admin') && !user.roles?.includes('professor'))) return;

    currentLogPage = page;
    const roomFilter = document.getElementById('adminLogRoomFilter').value;
    const userFilter = document.getElementById('adminLogUserFilter')?.value.trim();

    let url = `/api/classroom/admin/logs?page=${page}&limit=20`;
    if (roomFilter) url += `&room=${roomFilter}`;
    if (userFilter) url += `&username=${encodeURIComponent(userFilter)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        const tbody = document.getElementById('adminLogsTableBody');
        tbody.innerHTML = '';

        if (data.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#a89070;">No logs found.</td></tr>';
        } else {
            data.logs.forEach(log => {
                const tr = document.createElement('tr');
                const timeStr = new Date(log.timestamp).toLocaleString('en-GB', { hour12: false });

                let detailsStr = '';
                if (log.action === 'plant') detailsStr = `Planted ${log.details?.seed} (Slot ${log.details?.slot})`;
                else if (log.action === 'water') detailsStr = `Watered ${log.details?.seed} (Slot ${log.details?.slot})`;
                else if (log.action === 'harvest') detailsStr = `Harvested ${log.details?.herb} (Slot ${log.details?.slot})`;
                else if (log.action === 'brew') detailsStr = `Brewed ${log.details?.potion}`;
                else if (log.action === 'cast_charm') detailsStr = `Cast ${log.details?.charm} (${log.details?.success ? 'Success' : 'Failed'})`;
                else detailsStr = JSON.stringify(log.details);

                tr.innerHTML = `
                    <td style="color:#a89070; font-size:0.75rem;">${timeStr}</td>
                    <td style="font-weight:bold; color:#d4af37;">${log.username}</td>
                    <td style="color:#8ab4f8; text-transform:capitalize;">${log.room}</td>
                    <td><span style="background:rgba(255,255,255,0.1); padding:0.2rem 0.5rem; border-radius:4px;">${log.action}</span></td>
                    <td style="font-style:italic;">${detailsStr}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        document.getElementById('logPageInfo').textContent = `Page ${data.page} of ${data.totalPages || 1}`;
        document.getElementById('logPrevPage').disabled = data.page <= 1;
        document.getElementById('logNextPage').disabled = data.page >= (data.totalPages || 1);

    } catch (err) {
        console.error('Failed to load logs', err);
    }
}

function changeLogPage(delta) {
    loadAdminLogs(currentLogPage + delta);
}

// ----------------------------------------------------
//  TOAST UTILITY
// ----------------------------------------------------
function showToast(message, type = 'success') {
    const existing = document.getElementById('magic-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'magic-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.color = '#fff';
    toast.style.fontFamily = "'Cinzel', serif";
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '99999';
    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    toast.style.background = type === 'success' ? 'linear-gradient(135deg, #1f4037, #99f2c8)' : 'linear-gradient(135deg, #cb2d3e, #ef473a)';
    if (type !== 'success') toast.style.color = '#fff'; else toast.style.color = '#000';

    toast.innerHTML = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Run init
window.onload = initClassroom;
