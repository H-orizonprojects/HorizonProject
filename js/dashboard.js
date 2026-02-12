document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    switchNav('shop'); // Default view
});

let currentUser = null;
let currentItems = [];
let currentRecipes = [];

// --- AUTHENTICATION ---
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

        // Initial Data Fetch
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
    if (currentUser.avatar) {
        document.getElementById('userAvatar').src = `https://cdn.discordapp.com/avatars/${currentUser.discordId}/${currentUser.avatar}.png`;
    }
    document.getElementById('userGold').textContent = currentUser.balance;
    document.getElementById('bankBalance').textContent = currentUser.balance;

    // Roles Display
    const roleContainer = document.getElementById('userRole');
    if (roleContainer) {
        roleContainer.innerHTML = currentUser.roles.map(r => `<span class="badge role-${r}">${r.toUpperCase()}</span>`).join('');
    }

    updateGoldStacks(currentUser.balance);
}

function setupAdminControls() {
    const adminPanel = document.getElementById('adminControls');
    if (adminPanel) {
        if (currentUser.roles.includes('admin') || currentUser.roles.includes('professor')) {
            adminPanel.classList.remove('hidden');
        }
    }
}

// --- NAVIGATION ---
window.switchNav = function (tabId) {
    // Update active tab buttons
    document.querySelectorAll('.spell-btn').forEach(btn => {
        btn.classList.remove('active');
        const text = btn.textContent.toLowerCase();
        if (text.includes(tabId) ||
            (tabId === 'shop' && text.includes('shop')) ||
            (tabId === 'craft' && text.includes('crafting')) ||
            (tabId === 'bank' && text.includes('bank')) ||
            (tabId === 'inventory' && text.includes('inventory'))) {
            btn.classList.add('active');
        }
    });

    // Switch active section
    document.querySelectorAll('.magic-section').forEach(sec => sec.classList.remove('active'));
    const targetSection = document.getElementById(tabId);
    if (targetSection) targetSection.classList.add('active');
}

// --- MAGIC SHOP ---
async function fetchShopItems() {
    try {
        const response = await fetch('/api/shop/items', { credentials: 'include' });
        currentItems = await response.json();
        renderShop(currentItems);
    } catch (err) { console.error('Failed to fetch shop items', err); }
}

function renderShop(items) {
    const container = document.getElementById('shopContainer');
    if (!container) return;

    const isAdmin = currentUser.roles.includes('admin') || currentUser.roles.includes('professor');

    container.innerHTML = items.map(item => `
        <div class="magic-card item-rarity-${item.rarity || 'common'}">
            ${isAdmin ? `<button class="delete-btn" title="Remove Item" onclick="deleteItem('${item._id}')">×</button>` : ''}
            <div class="card-image">
                <img src="${item.image || 'assets/images/placeholder_item.png'}" alt="${item.name}">
            </div>
            <div class="card-info">
                <h3>${item.name}</h3>
                <span class="item-type">${item.type}</span>
                <div class="price-tag">🪙 ${item.price} G</div>
                <button class="buy-spell-btn" onclick="buyItem('${item._id}')">Acquire</button>
            </div>
        </div>
    `).join('');
}

window.deleteItem = async function (itemId) {
    if (!confirm('Permanently remove this item from the market?')) return;
    try {
        const response = await fetch(`/api/shop/${itemId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (response.ok) {
            fetchShopItems();
        } else {
            alert('Failed to remove item.');
        }
    } catch (err) { console.error('Delete error:', err); }
}

window.buyItem = async function (itemId) {
    if (!confirm('Spend gold to acquire this item?')) return;
    try {
        const response = await fetch('/api/shop/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, quantity: 1 }),
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
            currentUser.balance = data.balance;
            renderUserProfile();
            fetchInventory();
            alert('Item acquired! It has been placed in your satchel.');
        } else {
            alert(data.message);
        }
    } catch (err) { alert('Transaction failed'); }
}

// --- ADMIN CONTROL ---
window.openAdminModal = () => {
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'block';
};
window.closeAdminModal = () => {
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'none';
};

window.handleAddItem = async function (e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const itemData = {
        name: formData.get('name'),
        type: formData.get('type'),
        price: parseInt(formData.get('price')),
        image: formData.get('image'),
        rarity: 'common'
    };

    try {
        const response = await fetch('/api/shop/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData),
            credentials: 'include'
        });

        if (response.ok) {
            alert('New artifact registered in the archives.');
            closeAdminModal();
            fetchShopItems();
            e.target.reset();
        } else {
            const data = await response.json();
            alert('Failed: ' + data.message);
        }
    } catch (err) { console.error('Add item error:', err); }
}

// --- CRAFTING STATION ---
async function fetchRecipes() {
    try {
        const response = await fetch('/api/craft/recipes', { credentials: 'include' });
        currentRecipes = await response.json();
        renderRecipes(currentRecipes);
    } catch (err) { console.error('Failed to fetch recipes', err); }
}

function renderRecipes(recipes) {
    const list = document.getElementById('recipeList');
    if (!list) return;

    list.innerHTML = recipes.map(recipe => `
        <div class="scroll-item" onclick="selectRecipe('${recipe._id}')">
            <h4>${recipe.resultItemId?.name || 'Ancient Formula'}</h4>
            <small>${recipe.craftingType}</small>
        </div>
    `).join('');
}

let selectedRecipe = null;
window.selectRecipe = function (recipeId) {
    selectedRecipe = currentRecipes.find(r => r._id === recipeId);
    if (!selectedRecipe) return;

    // Highlight in list
    document.querySelectorAll('.scroll-item').forEach(item => {
        item.classList.toggle('active', item.onclick.toString().includes(recipeId));
    });

    document.getElementById('craftingTitle').textContent = `Brewing: ${selectedRecipe.resultItemId.name}`;

    // Ingredients check
    const container = document.getElementById('craftingIngredients');
    const userInv = currentUser.inventory || [];

    const ingredientsHTML = selectedRecipe.ingredients.map(ing => {
        const userHas = userInv.find(i => i.itemId._id === ing.itemId._id || i.itemId === ing.itemId._id)?.quantity || 0;
        const hasEnough = userHas >= ing.quantity;
        return `
            <div class="ingredient-check ${hasEnough ? 'ok' : 'missing'}">
                <span>${ing.itemId.name}</span>
                <span>${userHas}/${ing.quantity}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = ingredientsHTML;

    // Button activation
    const canCraft = selectedRecipe.ingredients.every(ing => {
        const userHas = userInv.find(i => i.itemId._id === ing.itemId._id || i.itemId === ing.itemId._id)?.quantity || 0;
        return userHas >= ing.quantity;
    });

    const btn = document.getElementById('craftBtn');
    btn.disabled = !canCraft;
    btn.onclick = () => craftItem(recipeId);
}

async function craftItem(recipeId) {
    const cauldron = document.querySelector('.cauldron-visual');
    if (cauldron) cauldron.classList.add('brewing');

    // Immersive delay
    setTimeout(async () => {
        try {
            const response = await fetch('/api/craft/craft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipeId }),
                credentials: 'include'
            });
            const data = await response.json();

            if (cauldron) cauldron.classList.remove('brewing');

            if (response.ok) {
                alert('Success! ' + data.message);
                fetchInventory();
                if (selectedRecipe && selectedRecipe._id === recipeId) selectRecipe(recipeId);
            } else {
                alert(data.message);
            }
        } catch (err) {
            if (cauldron) cauldron.classList.remove('brewing');
            alert('The spell fizzled out...');
        }
    }, 2000);
}

// --- GRINGOTTS BANK ---
async function fetchBalance() {
    try {
        const response = await fetch('/api/bank/balance', { credentials: 'include' });
        const data = await response.json();
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

window.transferFunds = async function () {
    const recipient = document.getElementById('recipientId').value;
    const amount = document.getElementById('transferAmount').value;
    if (!recipient || !amount) {
        alert('Credentials and amount required.');
        return;
    }

    if (!confirm(`Authorize the Goblins to transfer ${amount} G to ${recipient}?`)) return;

    try {
        const response = await fetch('/api/bank/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientId: recipient, amount }),
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
            alert('The Goblins have moved your gold securely.');
            fetchBalance();
            document.getElementById('transferAmount').value = '';
        } else {
            alert(data.message);
        }
    } catch (err) { alert('The transfer owl got lost.'); }
}

// --- WIZARD INVENTORY ---
async function fetchInventory() {
    try {
        const response = await fetch('/auth/me', { credentials: 'include' });
        const data = await response.json();
        if (data.authenticated) {
            currentUser = data.user;
            const container = document.getElementById('inventoryContainer');
            if (!container) return;

            if (!currentUser.inventory || !currentUser.inventory.length) {
                container.innerHTML = '<p class="empty-msg">Your satchel is empty. Visit Diagon Alley to stock up.</p>';
                return;
            }

            container.innerHTML = currentUser.inventory.map(slot => {
                const name = slot.itemId?.name || 'Ancient Artifact';
                const img = slot.itemId?.image || 'assets/images/placeholder_item.png';
                return `
                    <div class="inventory-slot">
                        <img src="${img}" alt="${name}">
                        <span class="qty">${slot.quantity}</span>
                        <div class="tooltip">${name}</div>
                    </div>
                 `;
            }).join('');
        }
    } catch (err) { console.error('Inventory fetch failed', err); }
}
