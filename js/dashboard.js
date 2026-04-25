document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    switchNav('shop');
});

let currentUser = null;
let currentItems = [];
let currentRecipes = [];
let allItems = []; // For admin dropdowns

// ═══════════════════════════════════════════════
// CUSTOM CONFIRM DIALOG
// ═══════════════════════════════════════════════
function showConfirm(title, message, onOk, onCancel) {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    overlay.classList.add('active');

    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    function close() {
        overlay.classList.remove('active');
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
    }
    function handleOk() { close(); if (onOk) onOk(); }
    function handleCancel() { close(); if (onCancel) onCancel(); }

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
}

// ═══════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════
async function checkAuth() {
    try {
        // ดึงข้อมูล user และ dashboard status พร้อมกัน (parallel)
        const [statusRes, meRes] = await Promise.all([
            fetch('/api/users/dashboard/status').catch(() => null),
            fetch('/auth/me', { credentials: 'include' })
        ]);

        // ตรวจสอบ auth ก่อน
        const data = await meRes.json();
        if (!meRes.ok || !data.authenticated) {
            window.location.href = data?.redirect || '/?error=access_denied';
            return;
        }

        currentUser = data.user;

        // ตรวจสอบ dashboard status (ถ้าดึงมาได้)
        if (statusRes?.ok) {
            const statusData = await statusRes.json();
            if (statusData.isClosed) {
                const isAdmin = currentUser.roles.includes('admin') || currentUser.roles.includes('professor');
                if (!isAdmin) {
                    const overlay = document.getElementById('dashboardClosedOverlay');
                    const msg = document.getElementById('dashboardClosedMsg');
                    if (overlay) overlay.style.display = 'flex';
                    if (msg) msg.textContent = statusData.message || 'ระบบปิดชั่วคราว กรุณารอสักครู่...';
                    return;
                }
            }
        }

        // ตรวจสอบ Detention
        if (currentUser.isDetained && currentUser.detentionEndDate) {
            const end = new Date(currentUser.detentionEndDate);
            if (end > new Date()) {
                document.getElementById('detentionOverlay').style.display = 'flex';
                document.getElementById('detentionReasonDisplay').textContent = currentUser.detentionReason || "Rule Violation";

                const minutesEl = document.getElementById('detentionMinutesDisplay');
                const timerEl = document.getElementById('detentionTimer');

                const updateMinutes = () => {
                    const secsLeft = Math.ceil((end - new Date()) / 1000);
                    if (minutesEl) minutesEl.textContent = `คุณถูกกักบริเวณ (ประเมินเวลาคงเหลือ: ${Math.ceil(secsLeft / 60)} นาที)`;
                };
                updateMinutes();

                const interval = setInterval(() => {
                    const diff = end - new Date();
                    if (diff <= 0) { clearInterval(interval); window.location.reload(); return; }
                    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
                    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                    timerEl.textContent = `${h}:${m}:${s}`;
                    updateMinutes();
                }, 1000);
                return;
            }
        }

        // โหลด dashboard ปกติ
        renderUserProfile();
        setupAdminControls();
        fetchShopItems();
        fetchInventory();
        fetchRecipes();
        fetchBalance();
        fetchMailbox();
        fetchDailyQuests();

    } catch (err) {
        console.error('Auth check failed', err);
        window.location.href = '/';
    }
}

function renderUserProfile() {
    document.getElementById('userName').textContent = currentUser.username;
    if (currentUser.avatar && currentUser.discordId) {
        document.getElementById('userAvatar').src =
            `https://cdn.discordapp.com/avatars/${currentUser.discordId}/${currentUser.avatar}.png?size=128`;
    }
    document.getElementById('userGold').textContent = currentUser.balance;

    const roleContainer = document.getElementById('userRole');
    if (roleContainer) {
        const roleLabels = {
            admin: '⚡ ADMIN', professor: '🎓 PROFESSOR', student: '📚 STUDENT',
            garuda: '🦅 พญาครุฑ', naga: '🐍 พญานาค', qilin: '🦌 กิเลน', erawan: '🐘 เอราวัณ'
        };
        roleContainer.innerHTML = currentUser.roles.map(r =>
            `<span class="badge role-${r}">${roleLabels[r] || r.toUpperCase()}</span>`
        ).join('');
    }
    updateGoldStacks(currentUser.balance);
    renderHealthUI();
}

function renderHealthUI() {
    const hp = currentUser.health || 0;
    const maxHp = currentUser.maxHealth || 100;
    document.getElementById('userHpText').textContent = `${hp}/${maxHp}`;

    const hpPercentage = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    document.getElementById('userHpBar').style.width = `${hpPercentage}%`;

    const faintedOverlay = document.getElementById('faintedOverlay');
    const navButtons = document.querySelectorAll('.spell-btn:not([onclick*="inventory"]):not([onclick*="shop"]):not(#adminTabBtn):not([onclick*="openLogModal"])');

    if (hp < 30) {
        // FATIGUED/FAINTED State
        faintedOverlay.classList.add('active');
        navButtons.forEach(btn => btn.classList.add('disabled-btn'));
    } else {
        // NORMAL State
        faintedOverlay.classList.remove('active');
        navButtons.forEach(btn => btn.classList.remove('disabled-btn'));
    }
}

window.openRecoveryInventory = function () {
    document.getElementById('faintedOverlay').classList.remove('active');
    switchNav('inventory');
}

function setupAdminControls() {
    const isAdmin = currentUser.roles.includes('admin') || currentUser.roles.includes('professor');
    document.querySelectorAll('.admin-only').forEach(el => {
        el.classList.toggle('hidden', !isAdmin);
    });
    const adminPanel = document.getElementById('adminControls');
    if (adminPanel && isAdmin) adminPanel.classList.remove('hidden');

    const materialTab = document.getElementById('materialTabBtn');
    if (materialTab && !isAdmin) {
        materialTab.style.display = 'none';
    }
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
window.switchNav = function (tabId) {
    if (currentUser && currentUser.health < 30 && tabId !== 'inventory' && tabId !== 'shop' && tabId !== 'admin') {
        spawnEffect('❌', 'You are too exhausted to do this. Eat food first.');
        document.getElementById('faintedOverlay').classList.add('active');
        return;
    }

    document.querySelectorAll('.spell-btn').forEach(btn => btn.classList.remove('active'));
    const tabs = { shop: 'shop', craft: 'crafting', bank: 'bank', inventory: 'inventory', mailbox: 'mailbox', admin: 'admin' };
    document.querySelectorAll('.spell-btn').forEach(btn => {
        const text = btn.textContent.toLowerCase();
        if (text.includes(tabs[tabId] || tabId)) btn.classList.add('active');
    });

    document.querySelectorAll('.magic-section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');

    if (typeof updateMagicBgCanvas === 'function') updateMagicBgCanvas(tabId);

    // Load data when switching to specific tabs
    if (tabId === 'bank') fetchTransactions();
    if (tabId === 'admin') {
        loadAdminBoosters();
        loadAdminData();
    }
    if (tabId === 'mailbox') fetchMailbox();
    if (tabId === 'pets') fetchPets();
    if (tabId === 'divination') fetchDivinationStatus();
}

let currentShopPage = 1;
const SHOP_PAGE_SIZE = 12; // Small size to ensure we don't hit Vercel payload limits

async function fetchShopItems(page = 1) {
    try {
        currentShopPage = page;
        const typeParam = currentShopCategory !== 'all' ? `&type=${currentShopCategory}` : '';
        const response = await fetch(`/api/shop/items?page=${page}&limit=${SHOP_PAGE_SIZE}${typeParam}`, { credentials: 'include' });
        const data = await response.json();

        if (!response.ok) {
            console.error('Shop fetch failed:', data);
            const container = document.getElementById('shopContainer');
            if (container) {
                container.innerHTML = `
                    <div class="error-msg-box">
                        <p>🔮 The market archives are currently unstable.</p>
                        <small>${data.message || 'Please try again later.'}</small>
                    </div>`;
            }
            return;
        }

        const items = data.items || [];
        if (page === 1) {
            currentItems = items;
        } else {
            currentItems = [...currentItems, ...items];
        }

        allItems = currentItems; 
        renderShop(currentItems);

        // Handle pagination visibility based on hasMore property from backend
        const pagination = document.getElementById('shopPagination');
        if (pagination) {
            if (data.hasMore) {
                pagination.style.display = 'block';
            } else {
                pagination.style.display = 'none';
            }
        }

    } catch (err) { 
        console.error('Failed to fetch shop items', err);
        const container = document.getElementById('shopContainer');
        if (container) {
            container.innerHTML = '<p class="empty-msg">Error connecting to the market archives. Check your connection.</p>';
        }
    }
}

window.loadMoreShopItems = function() {
    fetchShopItems(currentShopPage + 1);
}

let currentShopCategory = 'all';

window.filterShop = function (category, btnEl) {
    currentShopCategory = category;

    // Update active tab styling
    const tabs = document.querySelectorAll('.shop-category-tabs .shop-tab');
    if (tabs.length) {
        tabs.forEach(t => t.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
    }

    // Reset and fetch from server for the specific category
    fetchShopItems(1);
}

// Global scope for search input
window.filterShopBySearch = function () {
    applyShopFilters();
}

function applyShopFilters() {
    const searchInput = document.getElementById('shopSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = currentItems;

    if (currentShopCategory !== 'all') {
        filtered = filtered.filter(item => item.type === currentShopCategory);
    }

    if (query) {
        filtered = filtered.filter(item =>
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.description && item.description.toLowerCase().includes(query))
        );
    }

    renderShop(filtered);
}

function renderShop(items) {
    const container = document.getElementById('shopContainer');
    if (!container) return;
    const isAdmin = currentUser.roles.includes('admin') || currentUser.roles.includes('professor');

    const isFainted = currentUser.health < 30;
    let isBuffed = false;
    let isCursed = false;

    if (currentUser?.dailyDivination?.expiryDate && new Date() < new Date(currentUser.dailyDivination.expiryDate)) {
        const buffType = currentUser.dailyDivination.buffType;
        if (buffType === 'shop_discount') isBuffed = true;
        else if (buffType === 'omen_broken' || buffType === 'omen_devil') isCursed = true;
    }

    if (!items.length) {
        container.innerHTML = '<p class="empty-msg">No items match your criteria.</p>';
        return;
    }

    container.innerHTML = items.map(item => {
        let displayPrice = item.price;
        let priceHtml = `🪙 ${item.price} G`;

        if (isBuffed) {
            displayPrice = Math.floor(item.price * 0.9);
            priceHtml = `<span style="text-decoration: line-through; opacity: 0.6; font-size: 0.9em;">🪙 ${item.price} G</span> <span style="color: #6af56a;">🪙 ${displayPrice} G</span>`;
        } else if (isCursed) {
            displayPrice = Math.ceil(item.price * 1.1);
            priceHtml = `<span style="text-decoration: line-through; opacity: 0.6; font-size: 0.9em;">🪙 ${item.price} G</span> <span style="color: #ff6b6b;">🪙 ${displayPrice} G</span>`;
        }

        return `
        <div class="magic-card item-rarity-${item.rarity || 'common'}">
            ${isAdmin ? `<button class="delete-btn" style="right:2.7rem;background:#2a3d2a;color:#6af56a;border-color:#3d5c3d;" title="Edit Item" onclick="openEditItemModal('${item._id}')">✎</button><button class="delete-btn" title="Remove Item" onclick="deleteItem('${item._id}')">×</button>` : ''}
            <div class="card-image">
                <img src="${item.image || 'assets/images/placeholder_item.png'}" alt="${item.name}" loading="lazy">
            </div>
            <div class="card-info">
                <h3>${item.name}</h3>
                ${item.description ? `<p class="item-desc">${item.description}</p>` : ''}
                <div class="tags-row">
                    <span class="item-type type-${item.type}">${item.type}</span>
                    <span class="item-rarity-tag rarity-${item.rarity || 'common'}">${(item.rarity || 'common').toUpperCase()}</span>
                </div>
                <div class="price-tag">${priceHtml}</div>
                <div class="card-buy-row">
                    <input type="number" id="qty-${item._id}" class="buy-qty-input" min="1" value="1"
                           title="Quantity" ${isFainted ? 'disabled' : ''}>
                    <button class="buy-spell-btn${isFainted ? ' disabled-btn' : ''}"
                            onclick="${isFainted ? '' : `buyItem('${item._id}')`}"
                            ${isFainted ? 'disabled title="ฟื้นฟู HP ก่อนซื้อ!"' : ''}>
                        ${isFainted ? '💤 Fainted' : 'Acquire'}
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

window.deleteItem = async function (itemId) {
    showConfirm('Remove Item', 'Permanently remove this item from the market?', async () => {
        try {
            const r = await fetch(`/api/shop/${itemId}`, { method: 'DELETE', credentials: 'include' });
            if (r.ok) { spawnEffect('✨', 'Item vanished!'); fetchShopItems(); }
            else alert('Failed to remove item.');
        } catch (err) { console.error(err); }
    });
}

window.buyItem = async function (itemId) {

    if (currentUser.health < 30) {
        spawnEffect('💤', 'You are too fainted to shop! Eat food first.');
        return;
    }
    const item = currentItems.find(i => i._id === itemId);
    const qtyInput = document.getElementById(`qty-${itemId}`);
    const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;

    let unitPrice = item?.price || 0;
    if (currentUser?.dailyDivination?.expiryDate && new Date() < new Date(currentUser.dailyDivination.expiryDate)) {
        const buffType = currentUser.dailyDivination.buffType;
        if (buffType === 'shop_discount') {
            unitPrice = Math.floor(unitPrice * 0.9);
        } else if (buffType === 'omen_broken' || buffType === 'omen_devil') {
            unitPrice = Math.ceil(unitPrice * 1.1);
        }
    }
    const totalCost = unitPrice * qty;

    showConfirm('Acquire Item', `Buy ${qty}x "${item?.name}" for ${totalCost}G?`, async () => {
        try {
            const r = await fetch('/api/shop/buy', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, quantity: qty }), credentials: 'include'
            });
            const data = await r.json();
            if (r.ok) {
                currentUser.balance = data.balance;
                renderUserProfile();
                fetchInventory();
                spawnEffect('🛍️', `Acquired ${qty}x ${item?.name}!`);
            } else spawnEffect('❌', data.message);
        } catch (err) { spawnEffect('❌', 'Transaction failed'); }
    });
}

// ═══════════════════════════════════════════════
// ADMIN MODAL (Add Item)
// ═══════════════════════════════════════════════
window.openAdminModal = () => document.getElementById('adminModal').style.display = 'block';

window.closeAdminModal = () => document.getElementById('adminModal').style.display = 'none';

window.cancelAdminModal = function () {
    // Clear all form fields
    const form = document.getElementById('addItemForm');
    if (form) form.reset();
    clearFileInput();
    document.getElementById('imagePreview').innerHTML = '';
    closeAdminModal();
};

window.clearFileInput = function () {
    const fileInput = document.getElementById('itemImageFile');
    if (fileInput) fileInput.value = '';
    document.getElementById('imagePreview').innerHTML = '';
};

window.handleAddItem = async function (e) {
    e.preventDefault();
    const fd = new FormData(e.target);

    let imageUrl = fd.get('image') || '';

    // If user uploaded a file, upload it first
    const fileInput = document.getElementById('itemImageFile');
    if (fileInput && fileInput.files.length > 0) {
        const uploadData = new FormData();
        uploadData.append('image', fileInput.files[0]);
        try {
            const uploadRes = await fetch('/api/shop/upload', {
                method: 'POST', body: uploadData, credentials: 'include'
            });
            if (uploadRes.ok) {
                const result = await uploadRes.json();
                imageUrl = result.imageUrl;
            } else {
                const err = await uploadRes.json();
                spawnEffect('❌', 'Upload failed: ' + err.message);
                return;
            }
        } catch (err) {
            console.error('Upload error:', err);
            spawnEffect('❌', 'Image upload failed');
            return;
        }
    }

    const itemData = {
        name: fd.get('name'), description: fd.get('description'), type: fd.get('type'),
        price: parseInt(fd.get('price')), image: imageUrl, rarity: fd.get('rarity') || 'common',
        mailboxMessage: fd.get('mailboxMessage') || ''
    };
    try {
        const r = await fetch('/api/shop/add', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData), credentials: 'include'
        });
        if (r.ok) {
            spawnEffect('📦', 'Item registered!');
            window.cancelAdminModal();
            fetchShopItems();
        } else {
            const data = await r.json();
            spawnEffect('❌', 'Failed: ' + data.message);
        }
    } catch (err) { console.error(err); }
}

// ═══════════════════════════════════════════════
// ADMIN MODAL (Edit Item)
// ═══════════════════════════════════════════════
window.openEditItemModal = function (itemId) {
    const item = currentItems.find(i => i._id === itemId);
    if (!item) return;
    document.getElementById('editItemId').value = item._id;
    document.getElementById('editItemName').value = item.name || '';
    document.getElementById('editItemDescription').value = item.description || '';
    const typeSelect = document.getElementById('editItemType');
    typeSelect.value = item.type || 'material';
    document.getElementById('editItemRarity').value = item.rarity || 'common';
    document.getElementById('editItemPrice').value = item.price || 0;
    document.getElementById('editItemImage').value = item.image || '';

    const mailboxInput = document.getElementById('editItemMailboxMessage');
    if (item.type === 'equipment') {
        mailboxInput.style.display = 'block';
        mailboxInput.value = item.mailboxMessage || '';
    } else {
        mailboxInput.style.display = 'none';
        mailboxInput.value = '';
    }

    document.getElementById('editItemModal').style.display = 'block';
}

window.closeEditItemModal = function () {
    document.getElementById('editItemModal').style.display = 'none';
}

window.handleEditItem = async function (e) {
    e.preventDefault();
    const itemId = document.getElementById('editItemId').value;
    const itemData = {
        name: document.getElementById('editItemName').value,
        description: document.getElementById('editItemDescription').value,
        type: document.getElementById('editItemType').value,
        rarity: document.getElementById('editItemRarity').value,
        price: parseInt(document.getElementById('editItemPrice').value),
        image: document.getElementById('editItemImage').value,
        mailboxMessage: document.getElementById('editItemMailboxMessage').value
    };
    try {
        const r = await fetch('/api/shop/' + itemId, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData), credentials: 'include'
        });
        if (r.ok) {
            spawnEffect('✨', 'Item updated!');
            closeEditItemModal();
            fetchShopItems();
        } else {
            const data = await r.json();
            spawnEffect('❌', 'Failed: ' + data.message);
        }
    } catch (err) { console.error(err); }
}

// image file preview
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('itemImageFile');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const preview = document.getElementById('imagePreview');
            if (e.target.files.length > 0) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    preview.innerHTML = `<img src="${ev.target.result}" alt="Preview" style="max-width:120px;border-radius:8px;margin-top:.5rem;">`;
                };
                reader.readAsDataURL(e.target.files[0]);
            } else {
                preview.innerHTML = '';
            }
        });
    }

    // Toggle mailbox message inputs based on item type
    const addTypeSelect = document.getElementById('addItemTypeSelect');
    const addMailboxInput = document.getElementById('addItemMailboxMessage');
    if (addTypeSelect && addMailboxInput) {
        addTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'equipment') {
                addMailboxInput.style.display = 'block';
            } else {
                addMailboxInput.style.display = 'none';
            }
        });
    }

    const editTypeSelect = document.getElementById('editItemType');
    const editMailboxInput = document.getElementById('editItemMailboxMessage');
    if (editTypeSelect && editMailboxInput) {
        editTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'equipment') {
                editMailboxInput.style.display = 'block';
            } else {
                editMailboxInput.style.display = 'none';
            }
        });
    }
});

// ═══════════════════════════════════════════════
// CRAFTING STATION
// ═══════════════════════════════════════════════
async function fetchRecipes() {
    try {
        const r = await fetch('/api/craft/recipes', { credentials: 'include' });
        currentRecipes = await r.json();

        // Inject Amortentia Potion Recipe dynamically
        const lovePotionRecipe = {
            _id: 'love_potion',
            resultItemName: 'Amortentia Potion',
            resultItemId: { image: 'assets/images/Amortentia.png', name: 'Amortentia Potion' },
            craftingType: 'cauldron',
            ingredients: [
                { itemId: { name: 'วัตถุดิบ Legendary ขนิดใดก็ได้ (Any Legendary Item)' }, quantity: 2 },
                { itemId: { name: 'วัตถุดิบ Rare ชนิดใดก็ได้ (Any Rare Item)' }, quantity: 2 }
            ]
        };
        currentRecipes.push(lovePotionRecipe);

        renderRecipes(currentRecipes);
    } catch (err) { console.error('Failed to fetch recipes', err); }
}

function getRecipeName(recipe) {
    return recipe.resultItemId?.name || recipe.resultItemName || 'Unknown';
}

function renderRecipes(recipes) {
    const list = document.getElementById('recipeList');
    if (!list) return;
    if (!recipes.length) {
        list.innerHTML = '<p class="empty-msg">No recipes available.</p>';
        return;
    }
    list.innerHTML = recipes.map(recipe => `
        <div class="scroll-item" onclick="selectRecipe('${recipe._id}')">
            <h4>${getRecipeName(recipe)}</h4>
            <small class="craft-type-tag">${recipe.craftingType}</small>
        </div>
    `).join('');
}

let selectedRecipe = null;
window.selectRecipe = function (recipeId) {
    selectedRecipe = currentRecipes.find(r => r._id === recipeId);
    if (!selectedRecipe) return;

    document.querySelectorAll('.scroll-item').forEach(item => item.classList.remove('active'));
    event?.target?.closest('.scroll-item')?.classList.add('active');

    document.getElementById('craftingTitle').textContent =
        `Brewing: ${getRecipeName(selectedRecipe)}`;

    const container = document.getElementById('craftingIngredients');
    const userInv = currentUser.inventory || [];

    if (recipeId === 'love_potion') {
        const legendaryItems = userInv.filter(i => i.itemId?.rarity === 'legendary');
        const rareItems = userInv.filter(i => i.itemId?.rarity === 'rare');

        const legCount = legendaryItems.reduce((s, i) => s + i.quantity, 0);
        const rareCount = rareItems.reduce((s, i) => s + i.quantity, 0);

        container.innerHTML = `
            <div class="ingredient-check ${legCount >= 2 ? 'ok' : 'missing'}">
                <span>Any Legendary Item</span>
                <span>${legCount}/2 ${legCount >= 2 ? '✅' : '❌'}</span>
            </div>
            <div class="ingredient-check ${rareCount >= 2 ? 'ok' : 'missing'}">
                <span>Any Rare Item</span>
                <span>${rareCount}/2 ${rareCount >= 2 ? '✅' : '❌'}</span>
            </div>
        `;

        const canCraft = legCount >= 2 && rareCount >= 2;
        const btn = document.getElementById('craftBtn');
        btn.disabled = !canCraft;
        btn.onclick = () => craftItem(recipeId);
        return;
    }

    container.innerHTML = selectedRecipe.ingredients.map(ing => {
        const ingId = ing.itemId?._id || ing.itemId;
        const userHas = userInv.find(i => (i.itemId?._id || i.itemId) === ingId)?.quantity || 0;
        const hasEnough = userHas >= ing.quantity;
        return `
            <div class="ingredient-check ${hasEnough ? 'ok' : 'missing'}">
                <span>${ing.itemId?.name || 'Unknown'}</span>
                <span>${userHas}/${ing.quantity} ${hasEnough ? '✅' : '❌'}</span>
            </div>
        `;
    }).join('');

    const canCraft = selectedRecipe.ingredients.every(ing => {
        const ingId = ing.itemId?._id || ing.itemId;
        const userHas = userInv.find(i => (i.itemId?._id || i.itemId) === ingId)?.quantity || 0;
        return userHas >= ing.quantity;
    });

    const btn = document.getElementById('craftBtn');
    btn.disabled = !canCraft;
    btn.onclick = () => craftItem(recipeId);
}


async function craftItem(recipeId) {
    const cauldron = document.querySelector('.cauldron-visual');
    if (cauldron) cauldron.classList.add('brewing');
    document.getElementById('craftBtn').disabled = true;

    // Crafting animation delay
    await new Promise(resolve => setTimeout(resolve, 2500));

    try {
        const r = await fetch('/api/craft/craft', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipeId }), credentials: 'include'
        });
        const data = await r.json();
        if (cauldron) cauldron.classList.remove('brewing');

        if (r.ok) {
            spawnCraftSuccess(data.resultItemName);
            fetchInventory();
            // Re-check recipe after inventory changed
            setTimeout(() => { if (selectedRecipe?._id === recipeId) selectRecipe(recipeId); }, 500);
        } else {
            alert(data.message);
        }
    } catch (err) {
        if (cauldron) cauldron.classList.remove('brewing');
        alert('The spell fizzled out...');
    }
}

function spawnCraftSuccess(itemName) {
    const overlay = document.getElementById('effectsOverlay');
    overlay.innerHTML = `
        <div class="craft-success-effect">
            <div class="craft-particles">
                ${Array.from({ length: 20 }, () => `<span class="particle" style="--x:${Math.random() * 200 - 100}px;--y:${Math.random() * -200 - 50}px;--d:${Math.random() * 2 + 0.5}s"></span>`).join('')}
            </div>
            <div class="craft-result-popup">
                <span class="glow-text">✨ Crafted! ✨</span>
                <h3>${itemName}</h3>
            </div>
        </div>
    `;
    overlay.classList.add('active');
    setTimeout(() => { overlay.classList.remove('active'); overlay.innerHTML = ''; }, 3000);
}

// ═══════════════════════════════════════════════
// Thanaraksh BANK
// ═══════════════════════════════════════════════
async function fetchBalance() {
    try {
        const r = await fetch('/api/bank/balance', { credentials: 'include' });
        const data = await r.json();
        if (data.balance !== undefined) {
            currentUser.balance = data.balance;
            renderUserProfile();
        }
    } catch (err) { }
}

function updateGoldStacks(balance) {
    const container = document.querySelector('.vault-gold-pile');
    if (!container) return;
    const stackCount = 7;
    let html = '';
    for (let i = 0; i < stackCount; i++) {
        const baseHeight = Math.min(balance / 50, 100);
        const randomVar = (Math.sin(i * 1.5) + i) * 8;
        const height = Math.max(5, baseHeight + randomVar);
        html += `<div class="coin-stack-visual" style="height: ${height}px"></div>`;
    }
    container.innerHTML = html;
}

let userTransactions = [];
let userTransactionsSkip = 0;
const USER_TX_LIMIT = 20;

async function fetchTransactions(loadMore = false) {
    if (!loadMore) {
        userTransactions = [];
        userTransactionsSkip = 0;
        const container = document.getElementById('transactionList');
        if (container) container.innerHTML = '<p class="empty-msg">Fetching ledger...</p>';
    }

    try {
        const r = await fetch(`/api/bank/transactions?skip=${userTransactionsSkip}&limit=${USER_TX_LIMIT}`, { credentials: 'include' });
        const txs = await r.json();

        if (txs.length > 0) {
            userTransactions = userTransactions.concat(txs);
            userTransactionsSkip += USER_TX_LIMIT;
        }

        renderTransactions(userTransactions);

        const btn = document.getElementById('loadMoreTxBtn');
        if (btn) btn.style.display = txs.length === USER_TX_LIMIT ? 'block' : 'none';

    } catch (err) { console.error(err); }
}

window.loadMoreTransactions = function () {
    fetchTransactions(true);
}

function renderTransactions(txs) {
    const container = document.getElementById('transactionList');
    if (!container) return;
    if (!txs.length) {
        container.innerHTML = '<p class="empty-msg">No transactions yet.</p>';
        return;
    }
    container.innerHTML = txs.map(tx => {
        const isSender = tx.senderName === currentUser.username;
        let logLabel = '';
        if (tx.type === 'admin_adjust') logLabel = `<span class="tx-tag adj">ADJ</span>`;
        else if (isSender) logLabel = `<span class="tx-tag out">OUT</span>`;
        else logLabel = `<span class="tx-tag in">IN</span>`;

        const color = isSender ? 'tx-out' : 'tx-in';
        const sign = isSender ? '-' : '+';
        return `
            <div class="tx-row ${color}">
                <div class="tx-icon-wrap">${logLabel}</div>
                <div class="tx-details">
                    <strong>${tx.description || tx.type}</strong>
                    <small>${new Date(tx.timestamp).toLocaleString('th-TH')}</small>
                </div>
                <span class="tx-amount">${sign}${tx.amount}G</span>
                <small class="tx-id">${tx.transactionId}</small>
            </div>
        `;
    }).join('');
}

window.transferFunds = async function () {
    const recipient = document.getElementById('recipientId').value.trim();
    const amount = parseInt(document.getElementById('transferAmount').value);
    if (!recipient || !amount || amount <= 0) {
        spawnEffect('❌', 'Please enter a valid recipient and amount.'); return;
    }
    showConfirm('Transfer Funds', `Transfer ${amount}G to "${recipient}"?`, async () => {
        // Gold flying animation
        spawnGoldTransfer();

        try {
            const r = await fetch('/api/bank/transfer', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipientId: recipient, amount }), credentials: 'include'
            });
            const data = await r.json();
            if (r.ok) {
                currentUser.balance = data.newBalance;
                renderUserProfile();
                fetchTransactions();
                document.getElementById('transferAmount').value = '';
                document.getElementById('recipientId').value = '';
                // Show receipt
                showTransferReceipt(data.transaction);
            } else {
                spawnEffect('❌', data.message);
            }
        } catch (err) { spawnEffect('❌', 'The transfer owl got lost.'); }
    });
}

function spawnGoldTransfer() {
    const overlay = document.getElementById('effectsOverlay');
    overlay.innerHTML = `
        <div class="transfer-effect">
            ${Array.from({ length: 15 }, (_, i) => `<span class="gold-coin" style="--delay:${i * 0.1}s;--x:${Math.random() * 100 - 50}px">🪙</span>`).join('')}
        </div>
    `;
    overlay.classList.add('active');
    setTimeout(() => { overlay.classList.remove('active'); overlay.innerHTML = ''; }, 2500);
}

function showTransferReceipt(tx) {
    const content = document.getElementById('receiptContent');
    content.innerHTML = `
        <div class="receipt-header">
            <h2>🏦 Thanaraksh Wizarding Bank</h2>
            <p>Official Transfer Receipt</p>
        </div>
        <hr class="receipt-divider">
        <div class="receipt-body">
            <div class="receipt-row"><span>Transaction ID:</span><strong>${tx.transactionId}</strong></div>
            <div class="receipt-row"><span>From:</span><strong>${tx.senderName}</strong></div>
            <div class="receipt-row"><span>To:</span><strong>${tx.recipientName}</strong></div>
            <div class="receipt-row receipt-amount"><span>Amount:</span><strong>🪙 ${tx.amount} Galleons</strong></div>
            <div class="receipt-row"><span>Date:</span><strong>${new Date(tx.timestamp).toLocaleString('th-TH')}</strong></div>
        </div>
        <hr class="receipt-divider">
        <p class="receipt-footer">✦ May your vaults ever overflow ✦</p>
    `;
    document.getElementById('receiptModal').style.display = 'block';
}

window.closeReceiptModal = () => document.getElementById('receiptModal').style.display = 'none';

window.downloadReceipt = function () {
    const content = document.getElementById('receiptContent');
    const text = content.innerText;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Thanaraksh_receipt_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════
// INVENTORY (with Use Item)
// ═══════════════════════════════════════════════
async function fetchInventory() {
    try {
        const r = await fetch('/api/users/me/inventory', { credentials: 'include' });
        if (!r.ok) {
            if (r.status === 401) window.location.href = '/?error=access_denied';
            return;
        }
        const data = await r.json();
        currentUser.inventory = data.inventory;
        renderInventory();
    } catch (err) { console.error('Inventory fetch failed', err); }
}

function renderInventory() {
    const container = document.getElementById('inventoryContainer');
    if (!container) return;
    const inv = currentUser.inventory || [];
    const isFainted = currentUser.health < 30; // เพิ่มบรรทัดนี้

    if (!inv.length) {
        container.innerHTML = '<p class="empty-msg">Your satchel is empty. Visit Diagon Alley to stock up.</p>';
        return;
    }

    container.innerHTML = inv.map(slot => {
        const item = slot.itemId;
        const name = item?.name || 'Unknown Artifact';
        const img = item?.image || 'assets/images/placeholder_item.png';
        const type = item?.type || 'unknown';
        const id = item?._id || slot.itemId;

        const isEgg = name.toLowerCase().includes('egg') || name.toLowerCase().includes('ไข่');
        const isPetFood = name.toLowerCase().includes('feed') || name.toLowerCase().includes('อาหารสัตว์') || (item?.description || '').includes('สัตว์');
        const isSpecialUse = name === 'Amortentia Potion' || name === 'Name Change Card' || name === 'บัตรเปลี่ยนชื่อ';
        const isUsable = (type === 'food' || type === 'potion') && !isEgg && !isPetFood;
        const isFood = type === 'food'; // food ใช้ได้แม้ fainted เพื่อฟื้นฟู

        let actionButtons = '';
        if (isEgg) {
            actionButtons = `<button class="use-item-btn" onclick="startIncubating('${id}')">Use (ฟักไข่)</button><button class="gift-item-btn" onclick="openSendGiftModal('${id}', '${name}', '${img}', ${slot.quantity})">Gift</button>`;
        } else if (isUsable || isSpecialUse) {
            const blockedByFaint = isFainted && !isFood;
            actionButtons = `
                <button class="use-item-btn${blockedByFaint ? ' disabled-btn' : ''}"
                    onclick="${blockedByFaint ? '' : `useItem('${id}', '${name}')`}"
                    ${blockedByFaint ? 'disabled title="ฟื้นฟู HP ด้วย Food ก่อน!"' : ''}>
                    ${blockedByFaint ? '💤' : 'Use'}
                </button>
                <button class="gift-item-btn" onclick="openSendGiftModal('${id}', '${name}', '${img}', ${slot.quantity})">Gift</button>`;
        } else {
            actionButtons = `<button class="gift-item-btn" style="width:100%;" onclick="openSendGiftModal('${id}', '${name}', '${img}', ${slot.quantity})">🎁 Gift</button>`;
        }

        return `
            <div class="inventory-slot">
                <img src="${img}" alt="${name}" loading="lazy">
                <span class="qty">${slot.quantity}</span>
                <div class="inv-tooltip">
                    <strong>${name}</strong>
                    <small>${type}</small>
                    <div class="inv-actions">
                        ${actionButtons}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.useItem = async function (itemId, itemName) {
    if (itemName === 'Amortentia Potion') {
        // Open custom modal for target username
        openAmortenteiaModal(itemId, itemName);
        return;
    }
    if (itemName === 'Name Change Card' || itemName === 'บัตรเปลี่ยนชื่อ') {
        openNameChangeModal(itemId, itemName);
        return;
    }

    showConfirm('Use Item', `Use "${itemName}"? It will be consumed from your inventory.`, async () => {
        // Sparkle effect
        spawnEffect('✨', `Using ${itemName}...`);

        try {
            const r = await fetch('/api/shop/use', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId }), credentials: 'include'
            });
            const data = await r.json();
            if (r.ok) {
                spawnEffect('🌟', data.message);
                if (data.newHealth !== undefined) {
                    currentUser.health = data.newHealth;
                    renderHealthUI();
                }
                fetchInventory();
            } else {
                spawnEffect('❌', data.message);
            }
        } catch (err) { spawnEffect('❌', 'Failed to use item.'); }
    });
}

function openNameChangeModal(itemId, itemName) {
    const newName = prompt('Enter your new display name:');
    if (!newName || !newName.trim()) return;

    showConfirm('Confirm Name Change', `Are you sure you want to change your display name to "${newName.trim()}"?`, async () => {
        try {
            const r = await fetch('/api/users/changeName', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, newName: newName.trim() }), credentials: 'include'
            });
            const data = await r.json();
            if (r.ok) {
                spawnEffect('✨', 'Name changed successfully!');
                currentUser.username = data.username;
                renderUserProfile();
                fetchInventory();
            } else spawnEffect('❌', data.message);
        } catch (err) { spawnEffect('❌', 'Failed to change name.'); }
    });
}

// ═══════════════════════════════════════════════
// DAILY MAGIC REWARD
// ═══════════════════════════════════════════════
let isDailyMagicCasting = false;

function showChestReward(amount) {
    // Remove any existing chest overlay
    const old = document.getElementById('chestRewardOverlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'chestRewardOverlay';
    overlay.style.cssText = `
        position:fixed;top:0;left:0;width:100%;height:100%;
        z-index:99999;display:flex;flex-direction:column;
        justify-content:center;align-items:center;
        background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
        animation:fadeInBg 0.3s ease;
    `;

    // Spawn particles
    const particles = Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * 360;
        const dist = 80 + Math.random() * 80;
        const x = Math.cos(angle * Math.PI / 180) * dist;
        const y = Math.sin(angle * Math.PI / 180) * dist;
        const emojis = ['✨', '🌟', '💫', '🪙', '⭐'];
        return `<span class="chest-particle" style="
            --px:${x}px;--py:${y}px;--d:${0.3 + Math.random() * 0.6}s;
            position:absolute;font-size:1.2rem;
            animation:burstOut var(--d) ease-out forwards;
        ">${emojis[Math.floor(Math.random() * emojis.length)]}</span>`;
    }).join('');

    overlay.innerHTML = `
        <style>
            @keyframes fadeInBg { from{opacity:0} to{opacity:1} }
            @keyframes chestOpen { 0%{transform:translateY(0) scale(1)} 30%{transform:translateY(-10px) scale(1.1)} 60%{transform:translateY(0) scale(1.05)} 100%{transform:scale(1)} }
            @keyframes burstOut { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--px),var(--py)) scale(0);opacity:0} }
            @keyframes popIn { from{transform:scale(0.2);opacity:0} to{transform:scale(1);opacity:1} }
        </style>
        <div style="position:relative;text-align:center;">
            <div style="font-size:5rem;animation:chestOpen 0.6s ease forwards;">🎁</div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);">${particles}</div>
            <div style="animation:popIn 0.4s 0.5s ease both;background:linear-gradient(135deg,#2a1b38,#1a0f28);border:2px solid #d4af37;border-radius:16px;padding:2rem 3rem;margin-top:1rem;box-shadow:0 0 40px rgba(212,175,55,0.5);">
                <div style="font-size:1rem;color:#d4af37;font-family:'Cinzel',serif;letter-spacing:2px;margin-bottom:0.5rem;">DAILY REWARD</div>
                <div style="font-size:3rem;color:#fff;font-family:'Cinzel',serif;font-weight:bold;text-shadow:0 0 20px #d4af37;">+${amount} G</div>
                <div style="color:#a89070;font-size:0.85rem;margin-top:0.5rem;">Galleons received!</div>
            </div>
            <button onclick="document.getElementById('chestRewardOverlay').remove()"
                style="margin-top:1.5rem;padding:0.6rem 2rem;background:linear-gradient(135deg,#d4af37,#b8902e);border:none;border-radius:20px;color:#1a0f28;font-family:'Cinzel',serif;font-weight:bold;cursor:pointer;font-size:0.9rem;">
                ✓ Claim
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    // Auto-remove after 6s
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 6000);
}

window.castDailyMagic = async function () {
    if (isDailyMagicCasting) return;
    const btn = document.getElementById('dailyMagicBtn');
    if (btn && btn.classList.contains('claimed')) {
        spawnEffect('⏳', 'Come back tomorrow at 8:00 AM!');
        return;
    }

    isDailyMagicCasting = true;

    try {
        const response = await fetch('/api/bank/daily', {
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();

        isDailyMagicCasting = false;

        if (response.ok) {
            // Only lock button for non-admins
            const isAdmin = currentUser && (currentUser.roles.includes('admin') || currentUser.roles.includes('professor'));
            if (!isAdmin && btn) btn.classList.add('claimed');
            currentUser.balance = data.newBalance;
            renderUserProfile();
            fetchTransactions();
            // Show treasure chest pop-up
            showChestReward(data.rewardAmount || 0);
        } else {
            spawnEffect('❌', data.message);
            if (!currentUser.roles.includes('admin') && response.status === 400 && data.message && data.message.includes('tomorrow')) {
                if (btn) btn.classList.add('claimed');
            }
        }
    } catch (err) {
        console.error(err);
        isDailyMagicCasting = false;
        spawnEffect('❌', 'The spell fizzled...');
    }
}

// ═══════════════════════════════════════════════
// MAILBOX & GIFTING 
// ═══════════════════════════════════════════════

// Fetch Inbox
async function fetchMailbox() {
    try {
        const r = await fetch('/api/gift/inbox', { credentials: 'include' });
        const gifts = await r.json();
        _mailboxGiftsCache = gifts;
        renderMailbox(gifts);

        // Update notification badge
        const badge = document.getElementById('mailBadge');
        if (badge) {
            if (gifts.length > 0) {
                badge.classList.remove('hidden');
                badge.textContent = gifts.length;
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (err) { console.error('Mailbox fetch failed', err); }
}

function renderMailbox(gifts) {
    const container = document.getElementById('mailboxContainer');
    if (!container) return;

    if (!gifts.length) {
        container.innerHTML = '<p class="empty-msg" style="grid-column: 1/-1;">Your mailbox is empty. No owls today...</p>';
        return;
    }

    container.innerHTML = gifts.map(gift => {
        const itemName = gift.itemId?.name || 'Unknown Artifact';
        const itemImg = gift.itemId?.image || 'assets/images/placeholder_item.png';
        const msgHtml = gift.message ? `<p class="gift-msg" style="font-style:italic;font-size:0.9rem;color:#5d3a1a;margin:0.4rem 0;">"${gift.message}"</p>` : '';

        return `
            <div class="gift-card letter-style">
                <div class="gift-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;">
                    <span class="gift-sender" style="font-family:'Cinzel',serif;font-size:0.9rem;color:#4e342e;font-weight:bold;">✉ From: ${gift.senderName}</span>
                    <span class="gift-time" style="font-size:0.75rem;color:#8d6e63;">${new Date(gift.timestamp).toLocaleDateString('th-TH')}</span>
                </div>
                ${msgHtml}
                <div class="gift-body" style="display:flex;align-items:center;gap:0.8rem;background:rgba(200,170,120,0.25);border-radius:6px;padding:0.6rem;margin:0.5rem 0;">
                    <img src="${itemImg}" alt="${itemName}" loading="lazy" style="width:42px;height:42px;object-fit:contain;border-radius:4px;">
                    <div>
                        <strong style="color:#3e2723;font-size:0.9rem;">${itemName}</strong><br>
                        <small style="color:#6d4c41;">Qty: ${gift.quantity}</small>
                    </div>
                </div>
                <button class="letter-send-btn" style="width:100%;margin-top:0.5rem;padding:0.5rem;" onclick="openReadLetterModal('${gift._id}')">📖 Open Letter</button>
            </div>
        `;
    }).join('');
}

window.claimGift = async function (giftId) {
    try {
        const r = await fetch('/api/gift/claim', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ giftId }), credentials: 'include'
        });
        const data = await r.json();
        if (r.ok) {
            spawnEffect('✨', data.message);
            fetchMailbox();
            fetchInventory();
        } else {
            spawnEffect('❌', data.message);
        }
    } catch (err) {
        spawnEffect('❌', 'Failed to claim gift.');
    }
}

// ═══════════════════════════════════════════════
// READ LETTER MODAL
// ═══════════════════════════════════════════════
let _mailboxGiftsCache = [];

window.openReadLetterModal = function (giftId) {
    const gift = _mailboxGiftsCache.find(g => g._id === giftId);
    if (!gift) return;
    const itemName = gift.itemId?.name || 'Unknown Artifact';
    const itemImg = gift.itemId?.image || 'assets/images/placeholder_item.png';
    document.getElementById('readLetterSender').textContent = 'From: ' + gift.senderName;
    document.getElementById('readLetterItemName').textContent = itemName;
    document.getElementById('readLetterItemImg').src = itemImg;
    document.getElementById('readLetterItemQty').textContent = 'Qty: ' + gift.quantity;
    document.getElementById('readLetterMessage').textContent = gift.message || '(No message included)';
    document.getElementById('readLetterGiftId').value = giftId;
    document.getElementById('readLetterModal').style.display = 'block';
}

window.closeReadLetterModal = function () {
    document.getElementById('readLetterModal').style.display = 'none';
}

window.submitClaimGift = function () {
    const giftId = document.getElementById('readLetterGiftId').value;
    if (giftId) { closeReadLetterModal(); claimGift(giftId); }
}

// Send Gift Modal
window.openSendGiftModal = function (itemId, itemName, itemImg, maxQty) {
    document.getElementById('giftModalItemId').value = itemId;
    document.getElementById('giftModalItemName').textContent = itemName;
    document.getElementById('giftModalItemImg').src = itemImg;
    document.getElementById('giftModalItemQty').textContent = `You have: ${maxQty}`;
    document.getElementById('giftModalQuantity').max = maxQty;
    document.getElementById('giftModalQuantity').value = 1;

    document.getElementById('sendGiftModal').style.display = 'block';
}

window.closeSendGiftModal = function () {
    document.getElementById('sendGiftModal').style.display = 'none';
    document.getElementById('giftModalRecipient').value = '';
    document.getElementById('giftModalMessage').value = '';
}

window.submitSendGift = async function () {
    const itemId = document.getElementById('giftModalItemId').value;
    const recipientId = document.getElementById('giftModalRecipient').value.trim();
    const quantity = parseInt(document.getElementById('giftModalQuantity').value) || 1;
    const message = document.getElementById('giftModalMessage').value.trim();

    if (!recipientId) {
        spawnEffect('❌', 'Please enter a recipient.'); return;
    }

    try {
        const r = await fetch('/api/gift/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientId, itemId, quantity, message }),
            credentials: 'include'
        });
        const data = await r.json();
        if (r.ok) {
            spawnEffect('📨', data.message);
            closeSendGiftModal();
            fetchInventory();
            fetchTransactions();
        } else {
            spawnEffect('❌', data.message);
        }
    } catch (err) {
        spawnEffect('❌', 'Owl failed to deliver the gift.');
    }
}

// ═══════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════
async function loadAdminData() {
    // Populate item dropdowns with lightweight list
    if (!allItems.length) {
        try {
            const r = await fetch('/api/shop/items/list', { credentials: 'include' });
            if (r.ok) {
                allItems = await r.json();
            }
        } catch (err) { console.error('Failed to load full item list for admin', err); }
    }

    const items = allItems.length ? allItems : currentItems;
    const selects = document.querySelectorAll('#recipeResultItem, .ing-item');
    selects.forEach(sel => {
        if (sel.options.length <= 1) {
            const optionsHtml = items.map(i => `<option value="${i._id}" data-img="${i.image || ''}">${i.name} (${i.type})</option>`).join('');
            sel.innerHTML = sel.id === 'recipeResultItem'
                ? '<option value="">Select existing item (optional)...</option>' + optionsHtml
                : '<option value="">Select item...</option>' + optionsHtml;
        }
    });

    const sendItemSelect = document.getElementById('adminSendItemSelect');
    if (sendItemSelect && sendItemSelect.options && sendItemSelect.options.length <= 1) {
        sendItemSelect.innerHTML = '<option value="" disabled selected>-- โปรดเลือกไอเทม --</option>' + 
            items.map(i => `<option value="${i._id}">${i.name} (${i.type})</option>`).join('');
    }

    // Attach listener for ingredient previews
    document.querySelectorAll('.ing-item').forEach(attachIngredientListener);
    // Load current recipes for management
    renderAdminRecipes();

    // Attach listener for item preview
    const resSel = document.getElementById('recipeResultItem');
    if (resSel && !resSel.dataset.listener) {
        resSel.dataset.listener = 'true';
        resSel.addEventListener('change', (e) => {
            const val = e.target.value;
            const preview = document.getElementById('recipeImagePreview');
            if (!val || !preview) {
                if (preview) preview.innerHTML = '';
                return;
            }
            const item = items.find(i => i._id === val);
            if (item && item.image) {
                preview.innerHTML = `<img src="${item.image}" alt="Preview" style="width:64px;height:64px;object-fit:contain;margin-top:0.75rem;border-radius:4px;border:1px solid rgba(212,175,55,0.3);background:rgba(0,0,0,0.5);padding:4px;">`;
            } else {
                preview.innerHTML = '';
            }
        });
    }
}

function renderAdminRecipes() {
    const container = document.getElementById('adminRecipeList');
    if (!container) return;
    if (!currentRecipes.length) {
        container.innerHTML = '<p class="empty-msg">No recipes yet.</p>';
        return;
    }
    container.innerHTML = currentRecipes.map(r => `
        <div class="scroll-item admin-recipe-item">
            <div>
                <strong>${getRecipeName(r)}</strong>
                <small>(${r.craftingType})</small>
                <br><small>Ingredients: ${r.ingredients.map(i => i.itemId?.name || '?').join(', ')}</small>
            </div>
            <button class="delete-btn small" onclick="adminDeleteRecipe('${r._id}')">🗑️</button>
        </div>
    `).join('');
}

window.addIngredientRow = function () {
    const container = document.getElementById('ingredientInputs');
    const items = allItems.length ? allItems : currentItems;
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.style.display = 'flex';
    row.style.gap = '0.5rem';
    row.style.alignItems = 'center';
    row.innerHTML = `
        <select class="parchment-input ing-item" style="flex:1;">
            <option value="">Select item...</option>
            ${items.map(i => `<option value="${i._id}" data-img="${i.image || ''}">${i.name} (${i.type})</option>`).join('')}
        </select>
        <img src="" class="ing-preview" style="width:32px;height:32px;object-fit:contain;display:none;">
        <input type="number" class="parchment-input ing-qty" placeholder="Qty" min="1" value="1" style="width:70px;">
        <button class="delete-btn small" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);
    attachIngredientListener(row.querySelector('.ing-item'));
}

function attachIngredientListener(selectElement) {
    if (!selectElement || selectElement.dataset.listener) return;
    selectElement.dataset.listener = 'true';
    selectElement.addEventListener('change', (e) => {
        const option = e.target.options[e.target.selectedIndex];
        const previewEl = e.target.parentElement.querySelector('.ing-preview');
        if (!previewEl) return;

        if (option && option.dataset.img) {
            previewEl.src = option.dataset.img;
            previewEl.style.display = 'block';
        } else {
            previewEl.src = '';
            previewEl.style.display = 'none';
        }
    });
}

window.adminAddRecipe = async function () {
    const resultItemId = document.getElementById('recipeResultItem').value;
    const resultItemName = document.getElementById('recipeResultName').value.trim();
    const craftingType = document.getElementById('recipeCraftType').value;

    if (!resultItemId && !resultItemName) {
        spawnEffect('❌', 'Enter a result item name or select one from the shop.'); return;
    }

    const rows = document.querySelectorAll('.ingredient-row');
    const ingredients = [];
    rows.forEach(row => {
        const itemId = row.querySelector('.ing-item').value;
        const qty = parseInt(row.querySelector('.ing-qty').value) || 1;
        if (itemId) ingredients.push({ itemId, quantity: qty });
    });

    if (!ingredients.length) { spawnEffect('❌', 'Add at least one ingredient.'); return; }

    const payload = { ingredients, craftingType };
    if (resultItemId) payload.resultItemId = resultItemId;
    if (resultItemName) payload.resultItemName = resultItemName;

    try {
        const r = await fetch('/api/craft/recipes/add', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
        });
        if (r.ok) {
            spawnEffect('📜', 'Recipe added!');
            // Reset recipe form
            document.getElementById('recipeResultName').value = '';
            document.getElementById('recipeResultItem').value = '';
            const preview = document.getElementById('recipeImagePreview');
            if (preview) preview.innerHTML = '';
            const firstRow = document.querySelector('#ingredientInputs .ingredient-row');
            if (firstRow) {
                firstRow.querySelector('.ing-item').value = '';
                firstRow.querySelector('.ing-qty').value = '1';
                const fPreview = firstRow.querySelector('.ing-preview');
                if (fPreview) { fPreview.src = ''; fPreview.style.display = 'none'; }
            }
            // Remove extra rows
            document.querySelectorAll('#ingredientInputs .ingredient-row:not(:first-child)').forEach(r => r.remove());
            fetchRecipes();
            setTimeout(renderAdminRecipes, 500);
        } else {
            const data = await r.json();
            spawnEffect('❌', 'Failed: ' + data.message);
        }
    } catch (err) { console.error(err); }
}

window.adminDeleteRecipe = async function (recipeId) {
    showConfirm('Delete Recipe', 'Are you sure you want to delete this recipe?', async () => {
        try {
            const r = await fetch(`/api/craft/recipes/${recipeId}`, { method: 'DELETE', credentials: 'include' });
            if (r.ok) {
                spawnEffect('🗑️', 'Recipe removed.');
                fetchRecipes();
                setTimeout(renderAdminRecipes, 500);
            }
        } catch (err) { console.error(err); }
    });
}

window.adminCheckWealth = async function () {
    const target = document.getElementById('adminCheckMoneyUser').value.trim();
    if (!target) { spawnEffect('❌', 'Enter a target username.'); return; }

    try {
        const r = await fetch(`/api/bank/admin/balance/${encodeURIComponent(target)}`, { credentials: 'include' });
        const data = await r.json();
        if (r.ok) {
            spawnEffect('💰', `${data.username} has ${data.balance} Galleons`);
            // You can also show it in an alert or custom UI if needed
        } else {
            spawnEffect('❌', data.message);
        }
    } catch (err) { console.error(err); spawnEffect('❌', 'Failed to check wealth.'); }
}

window.adminAdjustGold = async function () {
    const target = document.getElementById('adminTargetUser').value.trim();
    const amount = parseInt(document.getElementById('adminGoldAmount').value);
    const reason = document.getElementById('adminGoldReason').value.trim();

    if (!target || isNaN(amount)) { spawnEffect('❌', 'Fill in target user and amount.'); return; }

    const groupLabels = { '@all': 'ผู้ใช้ทุกคน', 'garuda': '🦅 Garuda ทั้งบ้าน', 'naga': '🐍 Naga ทั้งบ้าน', 'qilin': '🦌 Qilin ทั้งบ้าน', 'erawan': '🐘 Erawan ทั้งบ้าน' };
    const displayName = groupLabels[target.toLowerCase()] || `"${target}"`;

    showConfirm('Adjust Gold', `${amount > 0 ? 'เพิ่ม' : 'หัก'} ${Math.abs(amount)}G ${amount > 0 ? 'ให้' : 'จาก'} ${displayName}?`, async () => {
        try {
            const r = await fetch('/api/bank/admin/adjust', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: target, amount, reason }),
                credentials: 'include'
            });
            const data = await r.json();
            if (r.ok) {
                spawnEffect('💰', data.message);
                document.getElementById('adminTargetUser').value = '';
                document.getElementById('adminGoldAmount').value = '';
                document.getElementById('adminGoldReason').value = '';
            } else spawnEffect('❌', data.message);
        } catch (err) { console.error(err); }
    });
}

window.adminToggleDashboard = async function (isClosed) {
    const message = document.getElementById('adminCloseMsg')?.value.trim() || '';
    const label = isClosed ? 'ปิด' : 'เปิด';

    showConfirm(`${label} Dashboard`, `ยืนยัน${label} Dashboard สำหรับผู้ใช้ทั้งหมด?`, async () => {
        try {
            const r = await fetch('/api/users/dashboard/toggle', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isClosed, message }), credentials: 'include'
            });
            const data = await r.json();
            if (r.ok) {
                spawnEffect(isClosed ? '🔒' : '🔓', data.message);
                const inp = document.getElementById('adminCloseMsg');
                if (inp) inp.value = '';
            } else spawnEffect('❌', data.message);
        } catch (err) { spawnEffect('❌', 'Failed to toggle dashboard.'); }
    });
}

window.adminAdjustHealth = async function () {
    const targetUserId = document.getElementById('adminTargetHpUser').value.trim();
    const action = document.getElementById('adminHpAction').value;
    const healthAmount = document.getElementById('adminHpAmount').value;

    if (!targetUserId || !healthAmount) {
        spawnEffect('❌', 'Please enter target and HP amount.');
        return;
    }

    try {
        const r = await fetch('/api/users/admin/health', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId, action, healthAmount }),
            credentials: 'include'
        });
        const data = await r.json();
        if (r.ok) {
            spawnEffect('✨', data.message);
            // If admin adjusted THEIR OWN health, reflect immediately
            if (targetUserId.toLowerCase() === currentUser.username.toLowerCase() || targetUserId === currentUser.discordId) {
                currentUser.health = data.newHealth;
                renderHealthUI();
            }
            document.getElementById('adminTargetHpUser').value = '';
            document.getElementById('adminHpAmount').value = '';
        } else {
            spawnEffect('❌', data.message);
        }
    } catch (err) {
        spawnEffect('❌', 'Failed to adjust HP.');
    }
}

// ═══════════════════════════════════════════════
// LOG MODAL
// ═══════════════════════════════════════════════
let adminLogs = [];
let adminLogsSkip = 0;
const ADMIN_LOGS_LIMIT = 50;

window.openLogModal = async function () {
    document.getElementById('logModal').style.display = 'block';
    document.getElementById('logContainer').innerHTML = '<p class="empty-msg">Loading...</p>';
    adminLogs = [];
    adminLogsSkip = 0;
    const btn = document.getElementById('loadMoreLogsBtn');
    if (btn) btn.style.display = 'none';

    await fetchAndRenderLogs();
};

async function fetchAndRenderLogs() {
    try {
        const r = await fetch(`/api/bank/admin/logs?skip=${adminLogsSkip}&limit=${ADMIN_LOGS_LIMIT}`, { credentials: 'include' });
        const logs = await r.json();

        if (logs.length > 0) {
            adminLogs = adminLogs.concat(logs);
            adminLogsSkip += ADMIN_LOGS_LIMIT;
            const btn = document.getElementById('loadMoreLogsBtn');
            if (btn) btn.style.display = logs.length === ADMIN_LOGS_LIMIT ? 'block' : 'none';
        }

        renderLogContainer();
    } catch (err) {
        document.getElementById('logContainer').innerHTML = '<p class="empty-msg">Failed to load logs.</p>';
    }
}

window.loadMoreLogs = async function () {
    await fetchAndRenderLogs();
}

window.filterLogs = function () {
    renderLogContainer();
}

function renderLogContainer() {
    const query = (document.getElementById('logSearch')?.value || '').toLowerCase();

    const filtered = adminLogs.filter(log => {
        if (!query) return true;
        const searchStr = `${log.type} ${log.description} ${log.senderName} ${log.recipientName} ${log.amount}`.toLowerCase();
        return searchStr.includes(query);
    });

    if (!filtered.length) {
        document.getElementById('logContainer').innerHTML = '<p class="empty-msg">No activity yet.</p>';
        return;
    }
    const typeClass = (t) => {
        if (t === 'transfer') return 'transfer';
        if (t === 'purchase') return 'purchase';
        if (t === 'craft') return 'craft';
        if (t === 'daily_reward') return 'daily_reward';
        return 'admin_adjust';
    };
    document.getElementById('logContainer').innerHTML = filtered.map(log => `
        <div class="log-row">
            <span class="log-type ${typeClass(log.type)}">${log.type.replace('_', ' ')}</span>
            <div>
                <div>${log.description || '-'}</div>
                <div style="font-size:.72rem;color:#8a7a5a">${log.senderName || '?'} → ${log.recipientName || '?'}</div>
                <div class="log-time">${new Date(log.timestamp).toLocaleString('th-TH')}</div>
            </div>
            <span class="log-amount ${log.amount >= 0 ? 'pos' : 'neg'}">${log.amount >= 0 ? '+' : ''}${log.amount}G</span>
        </div>
    `).join('');
}

window.closeLogModal = () => document.getElementById('logModal').style.display = 'none';

window.adminDetainUser = async function () {
    const targetUserId = document.getElementById('adminDetainUser').value.trim();
    const minutes = document.getElementById('adminDetainMinutes').value;
    const reason = document.getElementById('adminDetainReason').value.trim();

    if (!targetUserId || !minutes) {
        spawnEffect('❌', 'Please enter target and duration.');
        return;
    }

    try {
        const r = await fetch('/api/users/admin/detain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId, minutes, reason }),
            credentials: 'include'
        });
        const data = await r.json();
        if (r.ok) {
            spawnEffect('⛓️', data.message);
            document.getElementById('adminDetainUser').value = '';
            document.getElementById('adminDetainMinutes').value = '';
            document.getElementById('adminDetainReason').value = '';
        } else {
            spawnEffect('❌', data.message);
        }
    } catch (err) {
        spawnEffect('❌', 'Failed to detain user.');
    }
}

// Close modals when clicking outside
window.onclick = function (event) {
    const modals = ['adminModal', 'receiptModal', 'logModal', 'sendGiftModal'];
    modals.forEach(id => {
        const modal = document.getElementById(id);
        if (event.target === modal) {
            if (id === 'sendGiftModal') closeSendGiftModal();
            else modal.style.display = 'none';
        }
    });
};

// ═══════════════════════════════════════════════
// AMORTENTIA POTION - Custom Target Modal
// ═══════════════════════════════════════════════
function openAmortenteiaModal(itemId, itemName) {
    const modal = document.getElementById('amortenteiaModal');
    if (!modal) return;
    document.getElementById('amortenteiaItemId').value = itemId;
    document.getElementById('amortenteiaTargetInput').value = '';
    modal.classList.add('active');
}

window.closeAmortenteiaModal = function () {
    const modal = document.getElementById('amortenteiaModal');
    if (modal) modal.classList.remove('active');
}

window.submitAmortenteia = async function () {
    const itemId = document.getElementById('amortenteiaItemId').value;
    const targetUsername = document.getElementById('amortenteiaTargetInput').value.trim();
    if (!targetUsername) {
        spawnEffect('❌', 'Please enter a target username.');
        return;
    }
    closeAmortenteiaModal();
    showConfirm('Amortentia Potion', `Cast Amortentia on "${targetUsername}"?`, async () => {
        spawnEffect('✨', `Casting Amortentia on ${targetUsername}...`);
        try {
            const r = await fetch('/api/shop/use', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, targetUsername }), credentials: 'include'
            });
            const data = await r.json();
            if (r.ok) {
                spawnEffect('💖', data.message);
                fetchInventory();
            } else {
                spawnEffect('❌', data.message);
            }
        } catch (err) { spawnEffect('❌', 'Failed to cast potion.'); }
    });
}
// ═══════════════════════════════════════════════
// SERVER BOOSTERS ADMIN
// ═══════════════════════════════════════════════
window.loadAdminBoosters = async function () {
    try {
        const r = await fetch('/api/users/boosters');
        if (r.ok) {
            const data = await r.json();
            data.forEach((b, i) => {
                const idx = i + 1;
                const nameInp = document.getElementById(`booster${idx}Name`);
                const countInp = document.getElementById(`booster${idx}Count`);
                if (nameInp) nameInp.value = b.name || '';
                if (countInp) countInp.value = b.boosts || 0;
            });
        }
    } catch (e) { console.error('Failed to load server boosters for admin', e); }
}

window.adminUpdateBoosters = async function () {
    const boosters = [];
    for (let i = 1; i <= 3; i++) {
        boosters.push({
            rank: i,
            title: i === 1 ? 'Arcane Sovereign' : (i === 2 ? 'Mystic Conqueror' : 'Enchanted Vanguard'),
            name: document.getElementById(`booster${i}Name`).value.trim() || '- ระบุชื่อ -',
            boosts: parseInt(document.getElementById(`booster${i}Count`).value) || 0
        });
    }

    try {
        const r = await fetch('/api/users/boosters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ boosters }),
            credentials: 'include'
        });
        const data = await r.json();
        if (r.ok) {
            spawnEffect('✨', 'Server Boosters updated successfully!');
        } else {
            spawnEffect('❌', 'Error updating boosters');
        }
    } catch (e) { spawnEffect('❌', 'Failed to update boosters'); }
}


// ═══════════════════════════════════════════════
// EFFECTS / ANIMATIONS
// ═══════════════════════════════════════════════
function spawnEffect(emoji, text) {
    const overlay = document.getElementById('effectsOverlay');
    overlay.innerHTML = `
        <div class="toast-effect">
            <span class="toast-emoji">${emoji}</span>
            <span class="toast-text">${text}</span>
        </div>
    `;
    overlay.classList.add('active');
    setTimeout(() => { overlay.classList.remove('active'); overlay.innerHTML = ''; }, 2500);
}

// ═══════════════════════════════════════════════
// DAILY QUESTS
// ═══════════════════════════════════════════════
async function fetchDailyQuests() {
    try {
        const res = await fetch('/api/quests', { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.quests) {
            currentUser.dailyQuests = data.quests;
            updateQuestsBadge();
        }
    } catch (err) {
        console.error('Failed to fetch quests', err);
    }
}

function updateQuestsBadge() {
    const badge = document.getElementById('questsBadge');
    if (!badge || !currentUser.dailyQuests) return;
    const hasClaimable = currentUser.dailyQuests.some(q => q.isCompleted && !q.isClaimed);
    if (hasClaimable) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

window.openQuestsModal = function () {
    document.getElementById('questsModal').style.display = 'block';
    renderQuests();
}

window.closeQuestsModal = function () {
    document.getElementById('questsModal').style.display = 'none';
}

function renderQuests() {
    const container = document.getElementById('questsContainer');
    if (!container || !currentUser?.dailyQuests) return;

    if (currentUser.dailyQuests.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#a89070;">No quests available today.</p>';
        return;
    }

    const questLabels = {
        'explore_himmapan': '🌲 เอาตัวรอดในป่าหิมพานต์ (Explore Himmapan)',
        'craft_potion': '⚗️ ปรุงยาเวทมนตร์ (Craft Potion)',
        'buy_item': '🛒 ซื้อไอเทมจากร้านค้า (Buy Item)',
        'send_gift': '🦉 ส่งของขวัญให้เพื่อน (Send Gift)'
    };

    container.innerHTML = currentUser.dailyQuests.map(q => {
        const title = questLabels[q.questType] || q.questType;
        const progressPct = Math.min(100, (q.progress / q.target) * 100);
        const rewardText = q.rewardType === 'galleons' ? `${q.rewardAmount} Galleons` : `สุ่มวัตถุดิบ (Random Material) x${q.rewardAmount}`;

        let actionHTML = '';
        if (q.isClaimed) {
            actionHTML = `<div class="quest-claimed-stamp" style="display:block;">CLAIMED</div>`;
        } else if (q.isCompleted) {
            actionHTML = `<button class="quest-claim-btn" style="display:block;" onclick="claimQuest('${q._id}')">✨ Claim Reward</button>`;
        }

        return `
            <div class="quest-card ${q.isCompleted ? 'completed' : ''}">
                <div class="quest-header">
                    <h3 class="quest-title">${title}</h3>
                    <span class="quest-progress-text">${q.progress} / ${q.target}</span>
                </div>
                <div class="quest-bar-bg">
                    <div class="quest-bar-fill" style="width: ${progressPct}%"></div>
                </div>
                <div class="quest-reward">
                    🎁 รางวัล: <strong>${rewardText}</strong>
                </div>
                ${actionHTML}
            </div>
        `;
    }).join('');
}

window.claimQuest = async function (questId) {
    try {
        const res = await fetch('/api/quests/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questId }),
            credentials: 'include'
        });
        const data = await res.json();

        if (res.ok) {
            spawnEffect('✨', data.message);
            currentUser.balance = data.balance;
            currentUser.dailyQuests = data.quests;
            renderUserProfile();
            fetchInventory();
            renderQuests();
            updateQuestsBadge();
        } else {
            spawnEffect('❌', data.message);
        }
    } catch (err) {
        console.error(err);
        spawnEffect('❌', 'Failed to claim quest');
    }
}

// ═══════════════════════════════════════════════
// PETS & INCUBATOR
// ═══════════════════════════════════════════════
let currentPetsData = null;
let incubatorCountdownInterval = null;
let curseQuestInterval = null;

const SPECIES_EMOJI = {
    owl: '🦉', toad: '🐸', puffskein: '🐾', kneazle: '🐱',
    niffler: '🦡', seal: '🦭', hippogriff: '🦅', thestral: '🌑',
    dragon: '🐉', qilin: '🦌'
};

const BUFF_LABELS = {
    shop_bonus_chance: '🛍️ โอกาสได้ของฟรีเมื่อซื้อของ',
    herb_double_chance: '🌿 โอกาสเก็บสมุนไพร x2',
    craft_safety: '⚗️ เพิ่มโอกาสสำเร็จการคราฟต์',
    heal_chance: '💊 โอกาสฮีล HP อัตโนมัติ',
    max_hp: '❤️ HP สูงสุดเพิ่มขึ้น',
};

async function fetchPets() {
    try {
        const res = await fetch('/api/pets', { credentials: 'include' });
        if (res.ok) {
            currentPetsData = await res.json();
            renderIncubator(currentPetsData.incubator);
            renderMyPets(currentPetsData.pets, currentPetsData.activePetId);
        }
    } catch (error) {
        console.error('Failed to fetch pets data', error);
    }
    // Also load divination status when entering pets tab
    fetchDivinationStatus();
}

function renderIncubator(incubator) {
    const container = document.getElementById('incubatorContainer');
    if (!container) return;
    if (incubatorCountdownInterval) { clearInterval(incubatorCountdownInterval); incubatorCountdownInterval = null; }

    if (!incubator || !incubator.eggItemId) {
        container.innerHTML = `
            <div style="opacity:0.6; margin: 2rem 0; text-align:center;">
                <div style="font-size:3rem; margin-bottom:1rem;">🥚</div>
                <p style="color:#a89070; margin-top:0.5rem;">ตู้ฟักไข่ว่างเปล่า<br><small>วางไข่ปริศนาจาก Inventory เพื่อเริ่มฟัก</small></p>
            </div>
        `;
        return;
    }

    const { eggName, eggImage, hatchAt, isReadyToHatch } = incubator;

    function updateTimerDisplay() {
        const timerEl = document.getElementById('incubatorTimer');
        if (!timerEl) {
            // Timer element gone — stop interval to prevent memory leak
            if (incubatorCountdownInterval) { clearInterval(incubatorCountdownInterval); incubatorCountdownInterval = null; }
            return;
        }
        if (isReadyToHatch || !hatchAt) {
            timerEl.textContent = '✨ พร้อมฟักแล้ว!';
            timerEl.style.color = '#d4af37';
            return;
        }
        const remaining = new Date(hatchAt) - new Date();
        if (remaining <= 0) {
            // Stop the interval so it doesn't keep firing
            if (incubatorCountdownInterval) { clearInterval(incubatorCountdownInterval); incubatorCountdownInterval = null; }
            timerEl.textContent = '✨ พร้อมฟักแล้ว!';
            timerEl.style.color = '#d4af37';
            // Show hatch button by re-rendering — NOT calling fetchPets() in a loop
            const btnWrap = document.querySelector('#incubatorContainer .inc-btn-wrap');
            if (btnWrap) btnWrap.innerHTML = `<button class="conjure-btn" style="animation:pulse 1.5s infinite;" onclick="hatchEgg()">🐣 ฟักไข่เดี๋ยวนี้!</button>`;
            return;
        }
        const hh = Math.floor(remaining / 3600000).toString().padStart(2, '0');
        const mm = Math.floor((remaining % 3600000) / 60000).toString().padStart(2, '0');
        const ss = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
        timerEl.textContent = `⏳ ${hh}:${mm}:${ss} เหลืออยู่`;
    }

    const totalMs = 72 * 3600 * 1000;
    const remainMs = Math.max(0, new Date(hatchAt) - new Date());
    const elapsedPct = Math.min(100, ((totalMs - remainMs) / totalMs) * 100);

    container.innerHTML = `
        <div style="text-align:center;">
            <img src="${eggImage || 'assets/images/picitem/Egg.png'}" 
                 style="width:100px; height:100px; object-fit:contain; margin-bottom:1rem; ${isReadyToHatch ? 'animation: wiggle 0.5s infinite;' : 'animation: float 3s ease-in-out infinite;'}"
                 onerror="this.src='assets/images/placeholder_item.png'">
            <h4 style="color:#d4af37; margin:0 0 0.5rem 0; font-family:'Cinzel', serif;">${eggName}</h4>
            <div id="incubatorTimer" style="font-size:1rem; font-weight:bold; margin-bottom:0.75rem; color:#e0d0b0;"></div>
            <div class="quest-bar-bg" style="margin-bottom:0.5rem;">
                <div class="quest-bar-fill" style="width:${elapsedPct}%; background:linear-gradient(90deg,#d44b37,#f5a623);"></div>
            </div>
            <p style="color:#a89070; font-size:0.8rem; margin:0 0 1rem 0;">ความคืบหน้า: ${Math.floor(elapsedPct)}%</p>
            <div class="inc-btn-wrap" style="display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
                ${isReadyToHatch
            ? `<button class="conjure-btn" style="animation:pulse 1.5s infinite;" onclick="hatchEgg()">🐣 ฟักไข่เดี๋ยวนี้!</button>`
            : `<button class="buy-spell-btn" onclick="boostIncubation()">⚗️ ใช้ Incubation Potion (-24hr)</button>`
        }
            </div>
        </div>
    `;

    updateTimerDisplay();
    if (!isReadyToHatch) {
        incubatorCountdownInterval = setInterval(updateTimerDisplay, 1000);
    }
}

function renderMyPets(pets, activePetId) {
    const container = document.getElementById('petsListContainer');
    if (!container) return;

    if (!pets || pets.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#a89070; font-size:0.9rem; padding:2rem 0;">ยังไม่มีสัตว์เลี้ยง ฟักไข่ปริศนาเพื่อพบกับผู้คู่หูของคุณ!</p>';
        updateActivePetDisplay(null);
        return;
    }

    const activePet = pets.find(p => p._id.toString() === (activePetId || '').toString());
    updateActivePetDisplay(activePet || null);

    const today = new Date().toDateString();
    container.innerHTML = pets.map(pet => {
        const isActive = activePetId && activePetId.toString() === pet._id.toString();
        const species = pet.species || pet.petType || 'owl';
        const emoji = SPECIES_EMOJI[species] || '🐾';
        const buffLines = (pet.buffs || []).map(b => {
            const label = BUFF_LABELS[b.target] || b.target.replace(/_/g, ' ');
            return `<div style="font-size:0.78rem; color:#8ab4f8;">${label}: <strong>+${b.value}${b.target.includes('chance') || b.target.includes('safety') ? '%' : ' HP'}</strong></div>`;
        }).join('');

        const hungryPct = pet.hunger ?? 50;
        const affectionPct = pet.affection ?? 0;
        const affLvl = pet.affectionLevel || 1;
        const affStars = '⭐'.repeat(affLvl) + '☆'.repeat(3 - affLvl);
        const isFedToday = pet.lastFed && new Date(pet.lastFed).toDateString() === today;
        const isPettedToday = pet.lastPetted && new Date(pet.lastPetted).toDateString() === today;

        const rarityColors = { common: '#8ab4f8', rare: '#dd88ff', epic: '#ff9f40', legendary: '#ffd700' };
        const rc = rarityColors[pet.rarity] || '#8ab4f8';

        return `
            <div style="background:rgba(0,0,0,0.35); border:1.5px solid ${isActive ? '#d4af37' : '#443322'}; border-radius:12px; padding:1rem; margin-bottom:0.75rem; position:relative; overflow:hidden; transition: border-color 0.3s;">
                ${isActive ? '<div style="position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,#d4af37,#ffd700,#d4af37);"></div>' : ''}
                <div style="display:flex; gap:1rem; align-items:flex-start;">
                    <div style="text-align:center; min-width:80px;">
                        <img src="${pet.image}" loading="lazy" 
                             style="width:72px; height:72px; object-fit:contain; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid ${rc}33; animation: float 3s ease-in-out infinite; filter: drop-shadow(0 0 8px ${rc}80);"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                        <div style="display:none; font-size:2.5rem; line-height:72px; animation: float 3s ease-in-out infinite; filter: drop-shadow(0 0 8px ${rc}80);">${emoji}</div>
                        <span style="font-size:0.7rem; color:${rc}; text-transform:uppercase; font-weight:bold; display:block; margin-top:5px;">${pet.rarity}</span>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                            <h4 style="margin:0; color:${isActive ? '#d4af37' : '#e0d0b0'}; font-family:'Cinzel', serif; font-size:0.95rem;">${emoji} ${pet.name}</h4>
                            <span style="font-size:0.8rem;">${affStars}</span>
                        </div>
                        ${buffLines}
                        <div style="margin-top:0.5rem;">
                            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#a89070; margin-bottom:2px;">
                                <span>🍖 ความหิว</span><span>${hungryPct}/100</span>
                            </div>
                            <div style="background:rgba(255,255,255,0.1); border-radius:4px; height:6px; margin-bottom:0.4rem;">
                                <div style="width:${hungryPct}%; height:100%; background:linear-gradient(90deg,#ff6b35,#f7c59f); border-radius:4px;"></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#a89070; margin-bottom:2px;">
                                <span>💕 ความผูกพัน</span><span>${affectionPct}/100</span>
                            </div>
                            <div style="background:rgba(255,255,255,0.1); border-radius:4px; height:6px;">
                                <div style="width:${affectionPct}%; height:100%; background:linear-gradient(90deg,#ff69b4,#ff1493); border-radius:4px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:1rem; padding-top:1rem; border-top:1px dashed rgba(255,255,255,0.1);">
                    <button class="buy-spell-btn" style="${isActive ? 'background:linear-gradient(45deg, #8b6914, #d4af37); color:#000;' : ''}" onclick="toggleActivePet('${pet._id}', ${isActive})">
                        ${isActive ? '✦ ถอดออก (Unequip)' : '✦ สวมใส่ (Equip)'}
                    </button>
                    <button class="buy-spell-btn" style="background:${isFedToday ? 'rgba(100,100,100,0.5)' : 'linear-gradient(45deg, rgba(255,100,50,0.4), rgba(255,150,50,0.2))'}; ${isFedToday ? 'cursor:not-allowed; opacity:0.6;' : ''}"
                        onclick="${isFedToday ? '' : `feedPet('${pet._id}')`}" ${isFedToday ? 'disabled' : ''}>
                        🍖 ${isFedToday ? 'ให้อาหารแล้ว' : 'ให้อาหาร (Feed)'}
                    </button>
                    <button class="buy-spell-btn" style="background:${isPettedToday ? 'rgba(100,100,100,0.5)' : 'linear-gradient(45deg, rgba(255,105,180,0.4), rgba(255,20,147,0.2))'}; ${isPettedToday ? 'cursor:not-allowed; opacity:0.6;' : ''}"
                        onclick="${isPettedToday ? '' : `patPet('${pet._id}')`}" ${isPettedToday ? 'disabled' : ''}>
                        💖 ${isPettedToday ? 'ลูบหัวแล้ว' : 'ลูบหัว (Pat)'}
                    </button>
                    <button class="buy-spell-btn" style="background:linear-gradient(45deg, rgba(120,50,200,0.4), rgba(150,80,250,0.2));"
                        onclick="transferPetPrompt('${pet._id}')">
                        🦉 ส่งให้เพื่อน (Transfer)
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function updateActivePetDisplay(activePet) {
    const display = document.getElementById('activePetDisplay');
    const img = document.getElementById('activePetImg');
    const name = document.getElementById('activePetName');
    const buff = document.getElementById('activePetBuff');

    if (!display) return;

    if (!activePet) {
        display.style.display = 'none';
        if (typeof window.updatePet3DModel === 'function') {
            window.updatePet3DModel(null); // Fallback to default
        }
        return;
    }

    display.style.display = 'flex';
    if (img) { img.src = activePet.image; img.onerror = () => img.style.display = 'none'; }
    if (name) name.textContent = activePet.name;
    if (buff) {
        buff.innerHTML = (activePet.buffs || []).map(b => {
            const label = BUFF_LABELS[b.target] || b.target.replace(/_/g, ' ');
            return `<span style="font-size:0.8rem; color:#8ab4f8;">${label} +${b.value}${b.target.includes('chance') || b.target.includes('safety') ? '%' : ''}</span>`;
        }).join('<br>') || '✨ No active buffs';
    }

    // Update 3D Model dynamically based on species
    if (typeof window.updatePet3DModel === 'function') {
        window.updatePet3DModel(activePet.species);
    }
}

// Boost incubation using Incubation Potion
async function boostIncubation() {
    showConfirm('Incubation Boost', 'ใช้ Incubation Potion เพื่อร่นเวลาฟัก 24 ชั่วโมง?', async () => {
        try {
            const res = await fetch('/api/pets/boost', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (res.ok) {
                spawnEffect('⚗️', data.message);
                fetchInventory();
                renderIncubator(data.incubator);
            } else {
                spawnEffect('❌', data.message);
            }
        } catch (err) {
            console.error(err);
            spawnEffect('❌', 'Failed to boost incubation.');
        }
    });
}

async function hatchEgg() {
    try {
        const res = await fetch('/api/pets/hatch', { method: 'POST', credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
            spawnEffect('🐣', data.message);
            fetchPets();
        } else {
            spawnEffect('❌', data.message);
        }
    } catch (err) {
        console.error(err);
        spawnEffect('❌', 'Failed to hatch egg.');
    }
}

async function feedPet(petId) {
    try {
        const res = await fetch('/api/pets/feed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ petId }), credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            spawnEffect('🍖', data.message);
            fetchPets();
            fetchInventory();
        } else {
            spawnEffect('❌', data.message);
        }
    } catch (err) { spawnEffect('❌', 'Failed to feed pet.'); }
}

async function patPet(petId) {
    try {
        const res = await fetch('/api/pets/pat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ petId }), credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            spawnEffect('💖', data.message);
            fetchPets();
        } else {
            spawnEffect('❌', data.message);
        }
    } catch (err) { spawnEffect('❌', 'Failed to pat pet.'); }
}

async function toggleActivePet(petId, currentlyActive) {
    try {
        const reqPetId = currentlyActive ? null : petId;
        const res = await fetch('/api/pets/equip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ petId: reqPetId }), credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            spawnEffect('✨', data.message);
            currentPetsData.activePetId = reqPetId;
            renderMyPets(currentPetsData.pets, reqPetId);
            if (data.maxHealth) {
                currentUser.maxHealth = data.maxHealth;
                if (currentUser.health > currentUser.maxHealth) currentUser.health = currentUser.maxHealth;
                renderHealthUI();
            }
        } else {
            spawnEffect('❌', data.message);
        }
    } catch (err) {
        console.error(err);
        spawnEffect('❌', 'Failed to change active pet.');
    }
}

window.transferPetPrompt = function (petId) {
    document.getElementById('transferPetId').value = petId;
    document.getElementById('transferPetTargetInput').value = '';
    document.getElementById('transferPetModal').classList.add('active');
}

window.closeTransferPetModal = function () {
    document.getElementById('transferPetModal').classList.remove('active');
}

window.submitTransferPet = function () {
    const petId = document.getElementById('transferPetId').value;
    const toUser = document.getElementById('transferPetTargetInput').value.trim();

    if (!toUser) {
        spawnEffect('❌', 'Please enter a recipient username.');
        return;
    }

    closeTransferPetModal();

    showConfirm('โอนสัตว์เลี้ยง', `แน่ใจหรือไม่ที่จะส่งสัตว์เลี้ยงตัวนี้ให้ ${toUser}?`, async () => {
        try {
            const res = await fetch('/api/pets/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ petId, recipientUsername: toUser }), credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                spawnEffect('🦉', data.message);
                fetchPets();
            } else {
                spawnEffect('❌', data.message);
            }
        } catch (err) {
            console.error(err);
            spawnEffect('❌', 'Failed to transfer pet.');
        }
    });
}

async function startIncubating(itemId) {
    showConfirm('Incubator', 'Place this egg in the incubator for 72 hours?', async () => {
        try {
            const res = await fetch('/api/pets/incubate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId }), credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                spawnEffect('🥚', data.message);
                fetchInventory();
                switchNav('pets');
            } else {
                spawnEffect('❌', data.message);
            }
        } catch (err) {
            console.error(err);
            spawnEffect('❌', 'Failed to incubate egg.');
        }
    });
}

// ═══════════════════════════════════════════════
// DIVINATION TOWER
// ═══════════════════════════════════════════════
let currentDivinationData = null;

async function fetchDivinationStatus() {
    try {
        const res = await fetch('/api/divination/status', { credentials: 'include' });
        if (res.ok) {
            currentDivinationData = await res.json();
            renderDivination(currentDivinationData);
        }
    } catch (err) {
        console.error('Failed to fetch divination status', err);
    }
}

function renderDivination(data) {
    const container = document.getElementById('divinationContainer');
    if (!container) return;
    if (curseQuestInterval) { clearInterval(curseQuestInterval); curseQuestInterval = null; }

    const { canDraw, currentReading, curseQuest, buffType } = data || {};

    let curseHTML = '';
    if (curseQuest && curseQuest.isActive && !curseQuest.isCleansed) {
        const deadline = new Date(curseQuest.deadlineAt);
        const penalty = curseQuest.penaltyGalleons;
        curseHTML = `
            <div style="background: linear-gradient(145deg, rgba(80,10,10,0.8), rgba(30,5,5,0.95)); border: 1px solid #ff4444; border-radius: 16px; padding: 1.5rem; margin-bottom: 2.5rem; box-shadow: 0 0 30px rgba(255,0,0,0.25), inset 0 0 20px rgba(255,50,0,0.15); position: relative; overflow: hidden;">
                <div style="font-size: 2.2rem; text-align: center; margin-bottom: 0.5rem; animation: float 3s infinite;">☠️</div>
                <h3 style="color: #ff7070; text-align: center; margin: 0 0 0.5rem 0; font-family: 'Cinzel', serif; font-size: 1.4rem; letter-spacing: 2px;">The Grim's Curse</h3>
                <p style="color: #e0d0b0; text-align: center; margin: 0 auto 1.2rem auto; font-size: 0.95rem; max-width: 400px; line-height: 1.5;">Brew and consume a Cleansing Potion before time runs out to avoid losing <strong>${penalty}G</strong>.</p>
                <div id="curseTimer" style="text-align: center; font-size: 1.5rem; font-weight: bold; color: #ff6666; font-family: monospace; letter-spacing: 2px; margin-bottom: 1.2rem; text-shadow: 0 0 10px rgba(255,0,0,0.5);"></div>
                <div style="text-align: center;">
                    <button class="conjure-btn" style="background: linear-gradient(135deg, #7a0000, #aa1111); border: 1px solid #ff5555; padding: 0.8rem 2.5rem; font-size: 1.05rem; box-shadow: 0 0 20px rgba(255,0,0,0.4); border-radius: 8px; color: white; cursor: pointer; transition: 0.3s;" onclick="cleanseCurse()" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🧪 Drink Cleansing Potion</button>
                </div>
            </div>
        `;
        // Start countdown
        function updateCurseTimer() {
            const timerEl = document.getElementById('curseTimer');
            if (!timerEl) return;
            const remaining = deadline - new Date();
            if (remaining <= 0) {
                timerEl.textContent = '⏰ Time Expired! Gold Deducted.';
                clearInterval(curseQuestInterval);
                return;
            }
            const mm = Math.floor(remaining / 60000).toString().padStart(2, '0');
            const ss = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
            timerEl.textContent = `⏳ ${mm}:${ss} Remaining`;
        }
        updateCurseTimer();
        curseQuestInterval = setInterval(updateCurseTimer, 1000);
    }

    let readingHTML = '';
    if (currentReading) {
        const isOmen = currentReading.isOmen;
        const borderColor = isOmen ? '#ff4444' : '#55aa77';
        readingHTML = `
            <div style="background: linear-gradient(135deg, rgba(20,10,40,0.85), rgba(10,5,20,0.95)); border: 1px solid ${borderColor}; border-radius: 16px; padding: 2.5rem 1.5rem; margin-bottom: 2.5rem; text-align: center; animation: fadeIn 0.8s ease; box-shadow: 0 15px 35px rgba(0,0,0,0.6), inset 0 0 40px ${isOmen ? 'rgba(255,0,0,0.1)' : 'rgba(100,255,100,0.08)'}; position: relative;">
                <div style="font-size: 4rem; margin-bottom: 1rem; filter: drop-shadow(0 0 15px ${isOmen ? 'rgba(255,68,68,0.6)' : 'rgba(125,255,159,0.5)'}); animation: float 4s ease-in-out infinite;">${currentReading.emoji || '🔮'}</div>
                <h3 style="color: ${isOmen ? '#ff7070' : '#7dff9f'}; margin: 0 0 0.8rem 0; font-family: 'Cinzel', serif; font-size: 1.6rem; letter-spacing: 2px; text-shadow: 0 0 15px ${isOmen ? 'rgba(255,0,0,0.4)' : 'rgba(0,255,0,0.3)'};">${currentReading.buffName || currentReading.symbol}</h3>
                <p style="color: #e0d0b0; font-size: 1.05rem; line-height: 1.6; max-width: 500px; margin: 0 auto; font-style: italic;">"${currentReading.desc || ''}"</p>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="divination-viewport" style="background: rgba(10, 5, 12, 0.75); backdrop-filter: blur(12px); border-radius: 20px; border: 1px solid #4a3250; box-shadow: inset 0 0 60px rgba(138,43,226,0.05), 0 20px 50px rgba(0,0,0,0.7); padding: 3rem 2rem; max-width: 800px; margin: 0 auto; position: relative;">
            
            <div style="position: absolute; top: -100px; left: 50%; transform: translateX(-50%); width: 300px; height: 150px; background: radial-gradient(ellipse, rgba(138,43,226,0.25), transparent 70%); filter: blur(40px); pointer-events: none;"></div>

            <div style="text-align: center; margin-bottom: 2.5rem; position: relative; z-index: 2;">
                <div style="font-size: 4.5rem; animation: float 4s ease-in-out infinite; filter: drop-shadow(0 0 20px rgba(255,255,255,0.4)); margin-bottom: 0.5rem;">🔮</div>
                <h2 style="font-family: 'Cinzel', serif; color: #d4af37; font-size: 2.2rem; margin: 0 0 0.5rem 0; text-shadow: 0 0 15px rgba(212,175,55,0.4); letter-spacing: 3px;">Divination Tower</h2>
                <p style="color: #a89070; font-size: 1rem; margin: 0 auto; font-style: italic; max-width: 500px; line-height: 1.4;">Glimpse into the mists of time... but beware, for fate is fickle.</p>
            </div>

            ${curseHTML}
            ${readingHTML}

            ${canDraw ? `
            <div style="background: rgba(0,0,0,0.4); border: 1px solid #3a2230; border-radius: 16px; padding: 2rem; max-width: 500px; margin: 0 auto; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
                <p style="color: #d4af37; font-size: 1rem; font-family: 'Cinzel', serif; text-align: center; margin: 0 0 1.5rem 0; letter-spacing: 1px;">Focus your mind and choose your medium:</p>
                <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem;">
                    <button class="plot-btn" id="divineTea" onclick="setReadingType('tea_leaves')" style="flex: 1; padding: 1rem; font-size: 1.1rem; border-radius: 12px; background: rgba(50,30,20,0.8); border: 1px solid #8b5010; color: #f0e6c8; cursor: pointer; transition: 0.2s;">☕ Tea Leaves</button>
                    <button class="plot-btn" id="divineTarot" onclick="setReadingType('tarot')" style="flex: 1; padding: 1rem; font-size: 1.1rem; border-radius: 12px; background: rgba(20,20,40,0.8); border: 1px solid #4a3250; color: #f0e6c8; cursor: pointer; transition: 0.2s;">🃏 Tarot Cards</button>
                </div>
                <button class="conjure-btn" id="drawReadingBtn" style="width: 100%; font-size: 1.3rem; padding: 1rem; border-radius: 12px; background: linear-gradient(135deg, #4a1c6a, #8f34c8); box-shadow: 0 0 25px rgba(138,43,226,0.4); border: none; color: white; transition: all 0.3s; cursor: pointer;" onclick="drawReading()" onmouseover="this.style.boxShadow='0 0 35px rgba(138,43,226,0.6)'" onmouseout="this.style.boxShadow='0 0 25px rgba(138,43,226,0.4)'">
                    ✨ Divinate ✨
                </button>
            </div>
            ` : `
            <div style="text-align: center; color: #a89070; padding: 2.5rem; background: rgba(0,0,0,0.4); border: 1px dashed #4a3250; border-radius: 16px; max-width: 500px; margin: 0 auto;">
                <div style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.7; animation: float 3s infinite;">⏳</div>
                <p style="margin: 0; font-size: 1.1rem; font-family: 'Cinzel', serif; color: #d4af37; letter-spacing: 1px;">The mists have cleared for today.</p>
                <small style="display: block; margin-top: 0.5rem; opacity: 0.7;">Return at midnight for a new reading.</small>
            </div>
            `}
        </div>
    `;
}

let selectedReadingType = 'tea_leaves';
window.setReadingType = function (type) {
    selectedReadingType = type;
    ['divineTea', 'divineTarot'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.background = '';
    });
    const activeId = type === 'tea_leaves' ? 'divineTea' : 'divineTarot';
    const activeBtn = document.getElementById(activeId);
    if (activeBtn) activeBtn.style.background = 'rgba(212,175,55,0.3)';
};

window.drawReading = async function () {
    const btn = document.getElementById('drawReadingBtn');
    if (btn) { btn.disabled = true; btn.textContent = '🔮 กำลังพยากรณ์...'; }

    try {
        const res = await fetch('/api/divination/draw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ readingType: selectedReadingType }),
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            const emoji = data.reading?.emoji || '🔮';
            const isOmen = data.reading?.isOmen;
            spawnEffect(emoji, data.message.substring(0, 60));
            await fetchDivinationStatus();
            if (isOmen) spawnEffect('⚠️', 'ลางร้าย! รีบต้ม Cleansing Potion!');
        } else {
            spawnEffect('❌', data.message);
            if (btn) { btn.disabled = false; btn.textContent = '✨ ดูดวง ✨'; }
        }
    } catch (err) {
        spawnEffect('❌', 'Crystal ball error.');
        if (btn) { btn.disabled = false; btn.textContent = '✨ ดูดวง ✨'; }
    }
};

window.cleanseCurse = async function () {
    showConfirm('ล้างคำสาป', 'ใช้ Cleansing Potion เพื่อล้างคำสาปใช่ไหม?', async () => {
        try {
            const res = await fetch('/api/divination/cleanse', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (res.ok) {
                spawnEffect('✨', data.message);
                fetchDivinationStatus();
            } else {
                spawnEffect('❌', data.message);
            }
        } catch (err) {
            spawnEffect('❌', 'Cleansing failed.');
        }
    });
};

// ═══════════════════════════════════════════════
// THREE.JS MAGICAL BACKGROUND (PETS & DIVINATION)
// ═══════════════════════════════════════════════
let dashboardMagicScene = null;
let dashboardMagicTargetColor = new THREE.Color(0xd4af37);
let dashboardMagicActive = false;
let dashboardParticles, dashboardLight, dashboardObjects;

function initDashboardThreeJS() {
    const canvas = document.getElementById('dashboardMagicBg');
    if (!canvas || !window.THREE) return;

    dashboardMagicScene = new THREE.Scene();
    dashboardMagicScene.fog = new THREE.FogExp2(0x0a050f, 0.02);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, logarithmicDepthBuffer: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.position.z = 25;

    const ambientLight = new THREE.AmbientLight(0x221133, 1.5);
    dashboardMagicScene.add(ambientLight);

    dashboardLight = new THREE.PointLight(0xd4af37, 2, 50);
    dashboardLight.position.set(0, 5, 10);
    dashboardMagicScene.add(dashboardLight);

    const particleCount = 1000;
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

    dashboardParticles = new THREE.PointsMaterial({
        color: 0xd4af37,
        size: 0.8,
        map: particleTexture,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(particles, dashboardParticles);
    dashboardMagicScene.add(particleSystem);

    dashboardObjects = new THREE.Group();
    const geoTypes = [
        new THREE.OctahedronGeometry(1, 0),
        new THREE.DodecahedronGeometry(0.8, 0),
        new THREE.TetrahedronGeometry(1.2, 0)
    ];

    const objMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x4a1c6a,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8,
        wireframe: true,
        transparent: true,
        opacity: 0.5
    });

    for (let i = 0; i < 12; i++) {
        const mesh = new THREE.Mesh(geoTypes[Math.floor(Math.random() * geoTypes.length)], objMaterial.clone());
        mesh.position.set(
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 15 - 10
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        mesh.userData = {
            rotSpeedX: (Math.random() - 0.5) * 0.02,
            rotSpeedY: (Math.random() - 0.5) * 0.02,
            floatSpeed: Math.random() * 0.02 + 0.01,
            startY: mesh.position.y,
            offset: Math.random() * Math.PI * 2
        };
        dashboardObjects.add(mesh);
    }
    dashboardMagicScene.add(dashboardObjects);

    let mouseX = 0; let mouseY = 0;
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;
    document.addEventListener('mousemove', (event) => {
        if (!dashboardMagicActive) return;
        mouseX = (event.clientX - windowHalfX) * 0.05;
        mouseY = (event.clientY - windowHalfY) * 0.05;
    });

    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        if (!dashboardMagicActive) return;

        time += 0.01;
        camera.position.x += (mouseX * 0.1 - camera.position.x) * 0.05;
        camera.position.y += (-mouseY * 0.1 - camera.position.y) * 0.05;
        camera.lookAt(dashboardMagicScene.position);

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

        dashboardObjects.children.forEach(mesh => {
            mesh.rotation.x += mesh.userData.rotSpeedX;
            mesh.rotation.y += mesh.userData.rotSpeedY;
            mesh.position.y = mesh.userData.startY + Math.sin(time + mesh.userData.offset) * 2;
        });

        dashboardParticles.color.lerp(dashboardMagicTargetColor, 0.05);
        dashboardLight.color.lerp(dashboardMagicTargetColor, 0.05);
        dashboardObjects.children.forEach(mesh => {
            mesh.material.emissive.lerp(dashboardMagicTargetColor, 0.05);
        });

        renderer.render(dashboardMagicScene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        if (!dashboardMagicActive) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function updateMagicBgCanvas(tabId) {
    const canvas = document.getElementById('dashboardMagicBg');
    if (!canvas) return;

    if (tabId === 'pets' || tabId === 'divination') {
        if (!dashboardMagicScene) initDashboardThreeJS();
        dashboardMagicActive = true;

        // Ensure elements don't block canvas randomly
        canvas.style.display = 'block';
        // Let it layout before fading in
        setTimeout(() => { canvas.style.opacity = '1'; }, 50);

        if (tabId === 'pets') {
            dashboardMagicTargetColor.setHex(0xd46f10); // Warm fiery orange/gold
        } else if (tabId === 'divination') {
            dashboardMagicTargetColor.setHex(0x8a2be2); // Mystic purple
        }
    } else {
        canvas.style.opacity = '0';
        setTimeout(() => {
            if (canvas.style.opacity === '0') {
                dashboardMagicActive = false;
                canvas.style.display = 'none';
            }
        }, 1000);
    }
}

// ── Admin: Send Item / Material ──
window.adminSendItem = async function() {
    const targetInput = document.getElementById('adminSendTarget').value.trim();
    const itemId = document.getElementById('adminSendItemSelect').value;
    const quantity = parseInt(document.getElementById('adminSendQuantity').value) || 1;

    if (!targetInput) return spawnEffect('❌', 'Please specify a target username or house!');
    if (!itemId) return spawnEffect('❌', 'Please select an item!');

    const validHouses = ['garuda', 'naga', 'qilin', 'erawan', '@all'];
    let targetType = 'user';
    let targetId = targetInput;
    
    if (validHouses.includes(targetInput.toLowerCase())) {
        targetType = 'house';
    }

    if (!confirm(`Are you sure you want to send ${quantity} item(s) to ${targetInput}?`)) return;

    try {
        const res = await fetch('/api/gift/admin/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetType,
                targetId: targetInput,
                itemId,
                quantity
            })
        });
        const data = await res.json();
        if (res.ok) {
            spawnEffect('✨', data.message || 'Items sent successfully!');
            document.getElementById('adminSendTarget').value = '';
            document.getElementById('adminSendQuantity').value = '1';
        } else {
            spawnEffect('❌', data.message || 'Failed to send item');
        }
    } catch (err) {
        console.error(err);
        spawnEffect('❌', 'Server error while sending items');
    }
}
