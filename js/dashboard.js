document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    // Default tab
    switchNav('shop');
});

let currentUser = null;
let currentItems = [];
let currentRecipes = [];

// --- AUTH ---
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
        // window.location.href = '/'; // Temporarily disable redirect for debugging if needed
    }
}

function renderUserProfile() {
    document.getElementById('userName').textContent = currentUser.username;
    if (currentUser.avatar) {
        document.getElementById('userAvatar').src = `https://cdn.discordapp.com/avatars/${currentUser.discordId}/${currentUser.avatar}.png`;
    }
    document.getElementById('userGold').textContent = currentUser.balance;
    document.getElementById('bankBalance').textContent = currentUser.balance;

    // Roles
    const roleContainer = document.getElementById('userRole');
    roleContainer.innerHTML = currentUser.roles.map(r => `<span class="badge role-${r}">${r.toUpperCase()}</span>`).join('');
}

function setupAdminControls() {
    if (currentUser.roles.includes('admin') || currentUser.roles.includes('professor')) {
        document.getElementById('adminControls').classList.remove('hidden');
    }
}

// --- NAVIGATION ---
window.switchNav = function (tabId) {
    // Buttons
    document.querySelectorAll('.spell-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(tabId) ||
            (tabId === 'shop' && btn.textContent.includes('Shop')) ||
            (tabId === 'craft' && btn.textContent.includes('Crafting')) ||
            (tabId === 'bank' && btn.textContent.includes('Bank')) ||
            (tabId === 'inventory' && btn.textContent.includes('Inventory'))) {
            btn.classList.add('active');
        }
    });

    // Sections
    document.querySelectorAll('.magic-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

// --- SHOP ---
async function fetchShopItems() {
    try {
        const response = await fetch('/api/shop/items', { credentials: 'include' });
        currentItems = await response.json();
        renderShop(currentItems);
    } catch (err) { console.error(err); }
}

function renderShop(items) {
    const container = document.getElementById('shopContainer');
    container.innerHTML = items.map(item => `
        <div class="magic-card item-rarity-${item.rarity || 'common'}">
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
            alert('Item acquired successfully!');
        } else {
            alert(data.message);
        }
    } catch (err) { alert('Transaction failed'); }
}

// --- ADMIN MODAL ---
window.openAdminModal = () => document.getElementById('adminModal').style.display = 'block';
window.closeAdminModal = () => document.getElementById('adminModal').style.display = 'none';

window.handleAddItem = async function (e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const itemData = {
        name: formData.get('name'),
        type: formData.get('type'),
        price: formData.get('price'),
        image: formData.get('image'), // In a real app, handle file upload
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
        } else {
            alert('Failed to register item.');
        }
    } catch (err) { console.error(err); }
}

// --- CRAFTING ---
async function fetchRecipes() {
    try {
        const response = await fetch('/api/craft/recipes', { credentials: 'include' });
        currentRecipes = await response.json();
        renderRecipes(currentRecipes);
    } catch (err) { console.error(err); }
}

function renderRecipes(recipes) {
    const list = document.getElementById('recipeList');
    list.innerHTML = recipes.map(recipe => `
        <div class="scroll-item" onclick="selectRecipe('${recipe._id}')">
            <h4>${recipe.resultItemId?.name || 'Unknown Recipe'}</h4>
            <small>${recipe.craftingType}</small>
        </div>
    `).join('');
}

let selectedRecipe = null;
window.selectRecipe = function (recipeId) {
    selectedRecipe = currentRecipes.find(r => r._id === recipeId);
    if (!selectedRecipe) return;

    document.getElementById('craftingTitle').textContent = `Brewing: ${selectedRecipe.resultItemId.name}`;

    // Check ingredients
    const container = document.getElementById('craftingIngredients');
    const userInv = currentUser.inventory || [];

    const ingredientsHTML = selectedRecipe.ingredients.map(ing => {
        const userHas = userInv.find(i => i.itemId === ing.itemId._id)?.quantity || 0;
        const hasEnough = userHas >= ing.quantity;
        return `
            <div class="ingredient-check ${hasEnough ? 'ok' : 'missing'}">
                <span>${ing.itemId.name}</span>
                <span>${userHas}/${ing.quantity}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = ingredientsHTML;

    // Enable button
    const canCraft = selectedRecipe.ingredients.every(ing => {
        const userHas = userInv.find(i => i.itemId === ing.itemId._id)?.quantity || 0;
        return userHas >= ing.quantity;
    });

    const btn = document.getElementById('craftBtn');
    btn.disabled = !canCraft;
    btn.onclick = () => craftItem(recipeId);
}

async function craftItem(recipeId) {
    const cauldron = document.querySelector('.cauldron-visual');
    cauldron.classList.add('brewing'); // CSS Animation triggers

    setTimeout(async () => {
        try {
            const response = await fetch('/api/craft/craft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipeId }),
                credentials: 'include'
            });
            const data = await response.json();

            cauldron.classList.remove('brewing');

            if (response.ok) {
                alert('Success! ' + data.message); // replace with nice modal later
                fetchInventory();
                selectRecipe(recipeId); // Refresh counts
            } else {
                alert(data.message);
            }
        } catch (err) {
            cauldron.classList.remove('brewing');
            alert('The spell fizzled out...');
        }
    }, 2000); // Fake delay for animation
}

// --- BANK ---
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

window.transferFunds = async function () {
    const recipient = document.getElementById('recipientId').value;
    const amount = document.getElementById('transferAmount').value;
    if (!recipient || !amount) return;

    if (!confirm(`Transfer ${amount} G to ${recipient}?`)) return;

    try {
        const response = await fetch('/api/bank/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientId: recipient, amount }),
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
            alert('Goblins have secured the transfer.');
            fetchBalance();
        } else {
            alert(data.message);
        }
    } catch (err) { alert('Transfer failed.'); }
}

// --- INVENTORY ---
async function fetchInventory() {
    try {
        const response = await fetch('/auth/me', { credentials: 'include' });
        const data = await response.json();
        if (data.authenticated) {
            currentUser = data.user; // Update global user state including inventory
            const container = document.getElementById('inventoryContainer');

            if (!currentUser.inventory.length) {
                container.innerHTML = '<p class="empty-msg">Your satchel is empty.</p>';
                return;
            }

            container.innerHTML = currentUser.inventory.map(slot => {
                // Fallback if populate didn't work fully, though it should have
                const name = slot.itemId.name || 'Unknown Item';
                const img = slot.itemId.image || 'assets/images/placeholder_item.png';
                return `
                    <div class="inventory-slot">
                        <img src="${img}" alt="${name}">
                        <span class="qty">${slot.quantity}</span>
                        <div class="tooltip">${name}</div>
                    </div>
                 `;
            }).join('');
        }
    } catch (err) { }
}
