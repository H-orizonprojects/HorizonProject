document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupTabs();
});

let currentUser = null;
let currentItems = [];
let currentRecipes = [];

async function checkAuth() {
    try {
        const response = await fetch('/auth/me');
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = '/';
            return;
        }

        currentUser = data.user;
        renderUserProfile();

        // Initial Data Fetch
        fetchShopItems();
        fetchInventory();
        fetchRecipes();

        // Admin Check
        if (currentUser.roles.includes('admin') || currentUser.roles.includes('professor')) { // Adjust role check as needed
            document.getElementById('adminPanel').classList.add('visible');
        }

    } catch (err) {
        console.error('Auth check failed', err);
        window.location.href = '/';
    }
}

function renderUserProfile() {
    document.getElementById('userName').textContent = currentUser.username;
    document.getElementById('userAvatar').src = `https://cdn.discordapp.com/avatars/${currentUser.discordId}/${currentUser.avatar}.png`;
    document.getElementById('userGold').textContent = currentUser.balance;
    document.getElementById('bankBalance').textContent = currentUser.balance;
    document.getElementById('userRole').textContent = currentUser.roles.join(', ');
}

function setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            // 'this' doesn't work well in arrow functions if relying on caller, but here we use 'tab'
            // logic in HTML onclick="switchTab" might conflict if we verify listener here.
            // keeping the HTML onclick approach for simplicity or removing it.
            // Let's use the HTML onclick approach defined in HTML for switching, 
            // but ensure the function is global.
        });
    });
}

// Global scope for HTML onclicks
window.switchTab = function (tabName) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Find tab by text content or index? HTML has onclick, so we need to match
    // Actually simpler to just rely on the onclick logic entirely or event listener.
    // The HTML has onclick="switchTab('shop')", so we just need this function.

    // Add active to the clicked tab... wait, I need to know WHICH tab button was clicked
    // The visual update might be easier if I pass 'event' or just re-select based on text
    // Simpler: Just update content. Visual tab active state needs manual update if using onclick

    // Better: Select by text?
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(t => {
        if (t.innerText.toLowerCase().includes(tabName) ||
            (tabName === 'craft' && t.innerText.includes('Crafting')) ||
            (tabName === 'bank' && t.innerText.includes('Bank')) ||
            (tabName === 'inventory' && t.innerText.includes('Inventory'))) {
            t.classList.add('active');
        }
    });

    document.getElementById(tabName).classList.add('active');

    // Refresh data on tab switch
    if (tabName === 'inventory') fetchInventory();
    if (tabName === 'bank') fetchBalance(); // Re-sync balance
}

// --- SHOP ---
async function fetchShopItems() {
    try {
        const response = await fetch('/api/shop/items');
        currentItems = await response.json();
        renderShop(currentItems);
    } catch (err) {
        console.error('Failed to fetch items', err);
    }
}

function renderShop(items) {
    const container = document.getElementById('shopContainer');
    container.innerHTML = items.map(item => `
        <div class="item-card">
            <img src="${item.image || 'assets/images/placeholder_item.png'}" class="item-image" alt="${item.name}">
            <h3>${item.name}</h3>
            <p>${item.type}</p>
            <div class="item-price">💰 ${item.price} G</div>
            <button class="buy-btn" onclick="buyItem('${item._id}')">Buy</button>
        </div>
    `).join('');
}

window.buyItem = async function (itemId) {
    if (!confirm('Buy this item?')) return;

    try {
        const response = await fetch('/api/shop/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, quantity: 1 })
        });
        const data = await response.json();

        if (response.ok) {
            alert('Purchase successful!');
            currentUser.balance = data.balance;
            renderUserProfile();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Purchase failed');
    }
}

// --- INVENTORY ---
async function fetchInventory() {
    // Inventory is part of user object but we should refresh it
    try {
        const response = await fetch('/auth/me'); // Or dedicated /api/inventory
        const data = await response.json();
        if (data.authenticated) {
            currentUser = data.user;
            renderInventory(currentUser.inventory);
        }
    } catch (err) { console.log(err); }
}

function renderInventory(inventory) {
    const container = document.getElementById('inventoryContainer');
    if (!inventory || inventory.length === 0) {
        container.innerHTML = '<p>Your bag is empty.</p>';
        return;
    }

    // Need to map item IDs to Item Names (from currentItems or fetch with populate)
    // For now, let's assume currentItems has everything or we fallback

    const inventoryHtml = inventory.map(slot => {
        const itemDetails = currentItems.find(i => i._id === slot.itemId) || { name: 'Unknown Item', image: '' };
        return `
            <div class="item-card">
                <img src="${itemDetails.image || 'assets/images/placeholder_item.png'}" class="item-image" alt="${itemDetails.name}">
                <h3>${itemDetails.name}</h3>
                <p>Qty: ${slot.quantity}</p>
            </div>
        `;
    }).join('');

    container.innerHTML = inventoryHtml;
}

// --- CRAFTING ---
async function fetchRecipes() {
    try {
        const response = await fetch('/api/craft/recipes');
        currentRecipes = await response.json();
        renderRecipes(currentRecipes);
    } catch (err) {
        console.error('Failed to fetch recipes', err);
    }
}

function renderRecipes(recipes) {
    const list = document.getElementById('recipeList');
    list.innerHTML = recipes.map(recipe => `
        <div class="recipe-item" onclick="selectRecipe('${recipe._id}')">
            <span>📜</span>
            <div>
                <strong>${recipe.resultItemId.name}</strong><br>
                <small>${recipe.craftingType}</small>
            </div>
        </div>
    `).join('');
}

let selectedRecipe = null;

window.selectRecipe = function (recipeId) {
    selectedRecipe = currentRecipes.find(r => r._id === recipeId);
    if (!selectedRecipe) return;

    document.getElementById('craftingTitle').textContent = `Craft: ${selectedRecipe.resultItemId.name}`;

    // Show Ingredients
    const ingredientsHtml = selectedRecipe.ingredients.map(ing => {
        // Check if user has enough
        const userItem = currentUser.inventory.find(i => i.itemId === ing.itemId._id);
        const userQty = userItem ? userItem.quantity : 0;
        const hasEnough = userQty >= ing.quantity;

        return `
            <div style="color: ${hasEnough ? '#4caf50' : '#f44336'}">
                ${ing.itemId.name}: ${userQty} / ${ing.quantity}
            </div>
        `;
    }).join('');

    document.getElementById('craftingIngredients').innerHTML = ingredientsHtml;

    // Enable/Disable Button
    const canCraft = selectedRecipe.ingredients.every(ing => {
        const userItem = currentUser.inventory.find(i => i.itemId === ing.itemId._id);
        return userItem && userItem.quantity >= ing.quantity;
    });

    const btn = document.getElementById('craftBtn');
    btn.disabled = !canCraft;
    btn.onclick = () => craftItem(recipeId);
}

async function craftItem(recipeId) {
    try {
        const response = await fetch('/api/craft/craft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipeId })
        });
        const data = await response.json();

        if (response.ok) {
            alert('Crafting Successful!');
            // Refresh
            fetchInventory();
            selectRecipe(recipeId); // Re-render status
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Crafting failed');
    }
}

// --- BANK ---
async function fetchBalance() {
    try {
        const response = await fetch('/api/bank/balance');
        const data = await response.json();
        currentUser.balance = data.balance;
        renderUserProfile();
    } catch (err) { }
}

window.transferFunds = async function () {
    const recipient = document.getElementById('recipientId').value;
    const amount = document.getElementById('transferAmount').value;

    if (!recipient || !amount) return;

    try {
        const response = await fetch('/api/bank/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientId: recipient, amount })
        });
        const data = await response.json();

        if (response.ok) {
            alert('Transfer Successful!');
            fetchBalance();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Transfer failed');
    }
}

// --- ADMIN ---
window.openAddItemModal = function () {
    const name = prompt("Item Name:");
    if (!name) return;
    const type = prompt("Type (material/potion/equipment):");
    const price = prompt("Price:");

    // Simple implementation for now
    fetch('/api/shop/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, price, image: '', rarity: 'common' })
    }).then(res => {
        if (res.ok) {
            alert("Item Added");
            fetchShopItems();
        } else {
            alert("Failed");
        }
    });
}
