document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    switchNav('shop');
});

let currentUser = null;
let currentItems = [];
let currentRecipes = [];
let allItems = []; // For admin dropdowns

// ═══════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════
async function checkAuth() {
    try {
        const response = await fetch('/auth/me', { credentials: 'include' });
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = '/';
            return;
        }

        currentUser = data.user;
        renderUserProfile();
        setupAdminControls();

        fetchShopItems();
        fetchInventory();
        fetchRecipes();
        fetchBalance();

    } catch (err) {
        console.error('Auth check failed', err);
    }
}

function renderUserProfile() {
    document.getElementById('userName').textContent = currentUser.username;
    if (currentUser.avatar && currentUser.discordId) {
        document.getElementById('userAvatar').src =
            `https://cdn.discordapp.com/avatars/${currentUser.discordId}/${currentUser.avatar}.png?size=128`;
    }
    document.getElementById('userGold').textContent = currentUser.balance;
    document.getElementById('bankBalance').textContent = currentUser.balance;

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
}

function setupAdminControls() {
    const isAdmin = currentUser.roles.includes('admin') || currentUser.roles.includes('professor');
    document.querySelectorAll('.admin-only').forEach(el => {
        el.classList.toggle('hidden', !isAdmin);
    });
    const adminPanel = document.getElementById('adminControls');
    if (adminPanel && isAdmin) adminPanel.classList.remove('hidden');
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
window.switchNav = function (tabId) {
    document.querySelectorAll('.spell-btn').forEach(btn => btn.classList.remove('active'));
    const tabs = { shop: 'shop', craft: 'crafting', bank: 'bank', inventory: 'inventory', admin: 'admin' };
    document.querySelectorAll('.spell-btn').forEach(btn => {
        const text = btn.textContent.toLowerCase();
        if (text.includes(tabs[tabId] || tabId)) btn.classList.add('active');
    });

    document.querySelectorAll('.magic-section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');

    // Load data when switching to specific tabs
    if (tabId === 'bank') fetchTransactions();
    if (tabId === 'admin') loadAdminData();
}

// ═══════════════════════════════════════════════
// MAGIC SHOP
// ═══════════════════════════════════════════════
async function fetchShopItems() {
    try {
        const response = await fetch('/api/shop/items', { credentials: 'include' });
        currentItems = await response.json();
        allItems = currentItems;
        renderShop(currentItems);
    } catch (err) { console.error('Failed to fetch shop items', err); }
}

function renderShop(items) {
    const container = document.getElementById('shopContainer');
    if (!container) return;
    const isAdmin = currentUser.roles.includes('admin') || currentUser.roles.includes('professor');

    if (!items.length) {
        container.innerHTML = '<p class="empty-msg">The shelves are empty... An Admin must stock items first.</p>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="magic-card item-rarity-${item.rarity || 'common'}">
            ${isAdmin ? `<button class="delete-btn" title="Remove Item" onclick="deleteItem('${item._id}')">×</button>` : ''}
            <div class="card-image">
                <img src="${item.image || 'assets/images/placeholder_item.png'}" alt="${item.name}">
            </div>
            <div class="card-info">
                <h3>${item.name}</h3>
                ${item.description ? `<p class="item-desc">${item.description}</p>` : ''}
                <span class="item-type type-${item.type}">${item.type}</span>
                <span class="item-rarity-tag rarity-${item.rarity || 'common'}">${(item.rarity || 'common').toUpperCase()}</span>
                <div class="price-tag">🪙 ${item.price} G</div>
                <button class="buy-spell-btn" onclick="buyItem('${item._id}')">Acquire</button>
            </div>
        </div>
    `).join('');
}

window.deleteItem = async function (itemId) {
    if (!confirm('Permanently remove this item from the market?')) return;
    try {
        const r = await fetch(`/api/shop/${itemId}`, { method: 'DELETE', credentials: 'include' });
        if (r.ok) { spawnEffect('✨', 'Item vanished!'); fetchShopItems(); }
        else alert('Failed to remove item.');
    } catch (err) { console.error(err); }
}

window.buyItem = async function (itemId) {
    const item = currentItems.find(i => i._id === itemId);
    if (!confirm(`Buy "${item?.name}" for ${item?.price}G?`)) return;
    try {
        const r = await fetch('/api/shop/buy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, quantity: 1 }), credentials: 'include'
        });
        const data = await r.json();
        if (r.ok) {
            currentUser.balance = data.balance;
            renderUserProfile();
            fetchInventory();
            spawnEffect('🛍️', `Acquired ${item?.name}!`);
        } else alert(data.message);
    } catch (err) { alert('Transaction failed'); }
}

// ═══════════════════════════════════════════════
// ADMIN MODAL (Add Item)
// ═══════════════════════════════════════════════
window.openAdminModal = () => document.getElementById('adminModal').style.display = 'block';
window.closeAdminModal = () => document.getElementById('adminModal').style.display = 'none';

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
                alert('Image upload failed: ' + err.message);
                return;
            }
        } catch (err) {
            console.error('Upload error:', err);
            alert('Image upload failed');
            return;
        }
    }

    const itemData = {
        name: fd.get('name'), description: fd.get('description'), type: fd.get('type'),
        price: parseInt(fd.get('price')), image: imageUrl, rarity: fd.get('rarity') || 'common'
    };
    try {
        const r = await fetch('/api/shop/add', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData), credentials: 'include'
        });
        if (r.ok) {
            spawnEffect('📦', 'Item registered!');
            closeAdminModal();
            fetchShopItems();
            e.target.reset();
            document.getElementById('imagePreview').innerHTML = '';
        } else {
            const data = await r.json();
            alert('Failed: ' + data.message);
        }
    } catch (err) { console.error(err); }
}

// Image file preview
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('itemImageFile');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const preview = document.getElementById('imagePreview');
            if (e.target.files.length > 0) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    preview.innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
                };
                reader.readAsDataURL(e.target.files[0]);
            } else {
                preview.innerHTML = '';
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
        renderRecipes(currentRecipes);
    } catch (err) { console.error('Failed to fetch recipes', err); }
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
            <h4>${recipe.resultItemId?.name || 'Unknown'}</h4>
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
        `Brewing: ${selectedRecipe.resultItemId?.name || 'Unknown'}`;

    const container = document.getElementById('craftingIngredients');
    const userInv = currentUser.inventory || [];

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

async function fetchTransactions() {
    try {
        const r = await fetch('/api/bank/transactions', { credentials: 'include' });
        const txs = await r.json();
        renderTransactions(txs);
    } catch (err) { console.error(err); }
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
        const icon = tx.type === 'admin_adjust' ? '⚡' : (isSender ? '📤' : '📥');
        const color = isSender ? 'tx-out' : 'tx-in';
        const sign = isSender ? '-' : '+';
        return `
            <div class="tx-row ${color}">
                <span class="tx-icon">${icon}</span>
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
        alert('Please enter a valid recipient and amount.'); return;
    }
    if (!confirm(`Transfer ${amount}G to "${recipient}"?`)) return;

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
            alert(data.message);
        }
    } catch (err) { alert('The transfer owl got lost.'); }
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
        const r = await fetch('/auth/me', { credentials: 'include' });
        const data = await r.json();
        if (data.authenticated) {
            currentUser = data.user;
            renderInventory();
        }
    } catch (err) { console.error('Inventory fetch failed', err); }
}

function renderInventory() {
    const container = document.getElementById('inventoryContainer');
    if (!container) return;
    const inv = currentUser.inventory || [];

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
        return `
            <div class="inventory-slot">
                <img src="${img}" alt="${name}">
                <span class="qty">${slot.quantity}</span>
                <div class="inv-tooltip">
                    <strong>${name}</strong>
                    <small>${type}</small>
                    <button class="use-item-btn" onclick="useItem('${id}', '${name}')">Use</button>
                </div>
            </div>
        `;
    }).join('');
}

window.useItem = async function (itemId, itemName) {
    if (!confirm(`Use "${itemName}"? It will be consumed from your inventory.`)) return;

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
            fetchInventory();
        } else {
            alert(data.message);
        }
    } catch (err) { alert('Failed to use item.'); }
}

// ═══════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════
async function loadAdminData() {
    // Populate item dropdowns
    const items = allItems.length ? allItems : currentItems;
    const selects = document.querySelectorAll('#recipeResultItem, .ing-item');
    selects.forEach(sel => {
        if (sel.options.length <= 1) {
            sel.innerHTML = '<option value="">Select item...</option>' +
                items.map(i => `<option value="${i._id}">${i.name} (${i.type})</option>`).join('');
        }
    });
    // Load current recipes for management
    renderAdminRecipes();
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
                <strong>${r.resultItemId?.name || 'Unknown'}</strong>
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
    row.innerHTML = `
        <select class="parchment-input ing-item">
            <option value="">Select item...</option>
            ${items.map(i => `<option value="${i._id}">${i.name}</option>`).join('')}
        </select>
        <input type="number" class="parchment-input ing-qty" placeholder="Qty" min="1" value="1">
        <button class="delete-btn small" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);
}

window.adminAddRecipe = async function () {
    const resultItemId = document.getElementById('recipeResultItem').value;
    const craftingType = document.getElementById('recipeCraftType').value;
    if (!resultItemId) { alert('Select a result item.'); return; }

    const rows = document.querySelectorAll('.ingredient-row');
    const ingredients = [];
    rows.forEach(row => {
        const itemId = row.querySelector('.ing-item').value;
        const qty = parseInt(row.querySelector('.ing-qty').value) || 1;
        if (itemId) ingredients.push({ itemId, quantity: qty });
    });

    if (!ingredients.length) { alert('Add at least one ingredient.'); return; }

    try {
        const r = await fetch('/api/craft/recipes/add', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resultItemId, ingredients, craftingType }),
            credentials: 'include'
        });
        if (r.ok) {
            spawnEffect('📜', 'Recipe added!');
            fetchRecipes();
            setTimeout(renderAdminRecipes, 500);
        } else {
            const data = await r.json();
            alert('Failed: ' + data.message);
        }
    } catch (err) { console.error(err); }
}

window.adminDeleteRecipe = async function (recipeId) {
    if (!confirm('Delete this recipe?')) return;
    try {
        const r = await fetch(`/api/craft/recipes/${recipeId}`, { method: 'DELETE', credentials: 'include' });
        if (r.ok) {
            spawnEffect('🗑️', 'Recipe removed.');
            fetchRecipes();
            setTimeout(renderAdminRecipes, 500);
        }
    } catch (err) { console.error(err); }
}

window.adminAdjustGold = async function () {
    const target = document.getElementById('adminTargetUser').value.trim();
    const amount = parseInt(document.getElementById('adminGoldAmount').value);
    const reason = document.getElementById('adminGoldReason').value.trim();

    if (!target || isNaN(amount)) { alert('Fill in target user and amount.'); return; }
    if (!confirm(`Adjust ${target}'s balance by ${amount}G?`)) return;

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
        } else alert(data.message);
    } catch (err) { console.error(err); }
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
