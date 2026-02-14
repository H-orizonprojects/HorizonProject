<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import axios from 'axios';

const auth = useAuthStore();
const activeTab = ref('shop');

// State
const items = ref<any[]>([]);
const recipes = ref<any[]>([]);
const transactions = ref<any[]>([]);
const selectedRecipe = ref<any>(null);
const isBrewing = ref(false);
const showEffect = ref(false);
const effectEmoji = ref('');
const effectText = ref('');

// Form state
const transferRecipient = ref('');
const transferAmount = ref(0);

// Methods
const switchTab = (tab: string) => {
  activeTab.value = tab;
  if (tab === 'bank') fetchTransactions();
};

const fetchShopItems = async () => {
  try {
    const res = await axios.get('/api/shop/items');
    items.value = res.data;
  } catch (err) { console.error(err); }
};

const fetchRecipes = async () => {
  try {
    const res = await axios.get('/api/craft/recipes');
    recipes.value = res.data;
  } catch (err) { console.error(err); }
};

const fetchTransactions = async () => {
  try {
    const res = await axios.get('/api/bank/transactions');
    transactions.value = res.data;
  } catch (err) { console.error(err); }
};

const spawnEffect = (emoji: string, text: string) => {
  effectEmoji.value = emoji;
  effectText.value = text;
  showEffect.value = true;
  setTimeout(() => { showEffect.value = false; }, 2500);
};

const buyItem = async (item: any) => {
  if (!confirm(`Buy "${item.name}" for ${item.price}G?`)) return;
  try {
    const res = await axios.post('/api/shop/buy', { itemId: item._id, quantity: 1 });
    if (auth.user) auth.user.balance = res.data.balance;
    spawnEffect('🛍️', `Acquired ${item.name}!`);
  } catch (err) { alert('Transaction failed'); }
};

const selectRecipe = (recipe: any) => {
  selectedRecipe.value = recipe;
};

const canCraft = computed(() => {
  if (!selectedRecipe.value || !auth.user) return false;
  return selectedRecipe.value.ingredients.every((ing: any) => {
    const userItem = auth.user?.inventory?.find((i: any) => (i.itemId._id || i.itemId) === (ing.itemId._id || ing.itemId));
    return (userItem?.quantity || 0) >= ing.quantity;
  });
});

const craftItem = async () => {
  if (!selectedRecipe.value || isBrewing.value) return;
  isBrewing.value = true;
  await new Promise(r => setTimeout(r, 2500));
  try {
    const res = await axios.post('/api/craft/craft', { recipeId: selectedRecipe.value._id });
    spawnEffect('✨', `Crafted ${res.data.resultItemName}!`);
    await auth.checkAuth();
  } catch (err) { alert('Spell failed'); } finally { isBrewing.value = false; }
};

const transferFunds = async () => {
  if (!transferRecipient.value || transferAmount.value <= 0) return;
  if (!confirm(`Transfer ${transferAmount.value}G to ${transferRecipient.value}?`)) return;
  try {
    const res = await axios.post('/api/bank/transfer', {
      recipientId: transferRecipient.value,
      amount: transferAmount.value
    });
    if (auth.user) auth.user.balance = res.data.newBalance;
    spawnEffect('🦉', 'Owl dispatched!');
    fetchTransactions();
    transferRecipient.value = '';
    transferAmount.value = 0;
  } catch (err) { alert('Transfer failed'); }
};

onMounted(async () => {
  await auth.checkAuth();
  if (!auth.authenticated) {
    window.location.href = '/';
    return;
  }
  fetchShopItems();
  fetchRecipes();
});
</script>

<template>
  <div class="dashboard-wrapper">
    <header v-if="auth.user" class="wizard-profile">
      <div class="profile-card">
        <img :src="`https://cdn.discordapp.com/avatars/${auth.user.discordId}/${auth.user.avatar}.png`" class="avatar-frame">
        <div class="profile-info">
          <h1>{{ auth.user.username }}</h1>
          <div class="badges">
            <span v-for="role in auth.user.roles" :key="role" :class="['badge', `role-${role}`]">{{ role.toUpperCase() }}</span>
          </div>
          <div class="gold-pouch">
            <span class="gold-icon">🪙</span>
            <span class="gold-amount">{{ auth.user.balance }}</span> <span class="currency">Galleons</span>
          </div>
        </div>
      </div>

      <nav class="spell-nav">
        <button :class="['spell-btn', { active: activeTab === 'shop' }]" @click="switchTab('shop')">🔮 Magic Shop</button>
        <button :class="['spell-btn', { active: activeTab === 'craft' }]" @click="switchTab('craft')">⚗️ Crafting</button>
        <button :class="['spell-btn', { active: activeTab === 'bank' }]" @click="switchTab('bank')">🏦 Bank</button>
        <button :class="['spell-btn', { active: activeTab === 'inventory' }]" @click="switchTab('inventory')">🎒 Inventory</button>
      </nav>
    </header>

    <main class="magic-viewport">
      <!-- Shop -->
      <section v-if="activeTab === 'shop'" class="magic-section active">
        <div class="section-header">
          <h2>Diagon Alley Market</h2>
        </div>
        <div class="shop-shelves">
          <div v-for="item in items" :key="item._id" :class="['magic-card', `item-rarity-${item.rarity}`]">
            <div class="card-image">
              <img :src="item.image || '/assets/images/placeholder_item.png'">
            </div>
            <div class="card-info">
              <h3>{{ item.name }}</h3>
              <p class="item-desc">{{ item.description }}</p>
              <div class="price-tag">🪙 {{ item.price }} G</div>
              <button class="buy-spell-btn" @click="buyItem(item)">Acquire</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Crafting -->
      <section v-if="activeTab === 'craft'" class="magic-section active">
        <div class="crafting-layout">
          <div class="recipe-book">
            <h2>📜 Recipes</h2>
            <div class="scroll-content">
              <div v-for="recipe in recipes" :key="recipe._id" 
                   :class="['scroll-item', { active: selectedRecipe?._id === recipe._id }]"
                   @click="selectRecipe(recipe)">
                <h4>{{ recipe.resultItemId?.name }}</h4>
                <small class="craft-type-tag">{{ recipe.craftingType }}</small>
              </div>
            </div>
          </div>
          <div class="alchemist-lab">
            <div class="cauldron-container">
              <div :class="['cauldron-visual', { brewing: isBrewing }]">
                <img src="@/assets/item/brew1.png" class="cauldron-img">
              </div>
              <h3>{{ selectedRecipe ? `Brewing: ${selectedRecipe.resultItemId?.name}` : 'Select a Recipe' }}</h3>
            </div>
            <div v-if="selectedRecipe" class="ingredients-needed">
              <div v-for="ing in selectedRecipe.ingredients" :key="typeof ing.itemId === 'string' ? ing.itemId : ing.itemId._id" class="ingredient-check">
                <span>{{ ing.itemId.name }}</span>
                <span>{{ auth.user?.inventory?.find(i => (i.itemId._id || i.itemId) === (ing.itemId._id || ing.itemId))?.quantity || 0 }}/{{ ing.quantity }}</span>
              </div>
            </div>
            <button class="cast-spell-btn" :disabled="!canCraft || isBrewing" @click="craftItem">
              {{ isBrewing ? '✨ Brewing... ✨' : '✨ Brew Potion ✨' }}
            </button>
          </div>
        </div>
      </section>

      <!-- Bank -->
      <section v-if="activeTab === 'bank'" class="magic-section active">
        <div class="Thanaraksh-vault">
          <div class="vault-door">
            <h2>Vault Balance</h2>
            <div class="huge-balance"><span>{{ auth.user?.balance }}</span> G</div>
          </div>
          <div class="goblin-teller">
            <h3>💸 Transfer Funds</h3>
            <div class="input-group">
              <label>Recipient</label>
              <input v-model="transferRecipient" placeholder="e.g. nxvxn_" class="parchment-input">
            </div>
            <div class="input-group">
              <label>Amount</label>
              <input v-model.number="transferAmount" type="number" class="parchment-input">
            </div>
            <button @click="transferFunds" class="goblin-btn">Send via Owl 🦉</button>
          </div>
          <div class="transaction-history">
            <h3>📋 Transaction History</h3>
            <div class="scroll-content">
              <div v-for="tx in transactions" :key="tx.transactionId" class="tx-row">
                <div class="tx-details">
                  <strong>{{ tx.description || tx.type }}</strong>
                  <small>{{ new Date(tx.timestamp).toLocaleString() }}</small>
                </div>
                <span class="tx-amount">{{ tx.amount }}G</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Inventory -->
      <section v-if="activeTab === 'inventory'" class="magic-section active">
        <h2>Wizard's Satchel</h2>
        <div class="inventory-grid">
          <div v-for="slot in auth.user?.inventory" :key="typeof slot.itemId === 'string' ? slot.itemId : slot.itemId._id" class="inventory-slot">
            <img :src="slot.itemId.image || '/assets/images/placeholder_item.png'">
            <span class="qty">{{ slot.quantity }}</span>
            <div class="inv-tooltip">
              <strong>{{ slot.itemId.name }}</strong>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Global Effects -->
    <div v-if="showEffect" class="effects-overlay active">
      <div class="toast-effect">
        <span class="toast-emoji">{{ effectEmoji }}</span>
        <span class="toast-text">{{ effectText }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '@/assets/css/dashboard-magic.css';

.dashboard-wrapper {
  padding: 2rem;
  min-height: 100vh;
  background: #000;
  color: var(--text-light);
}

.wizard-profile {
  margin-bottom: 2rem;
}

.profile-card {
  display: flex;
  gap: 2rem;
  align-items: center;
  margin-bottom: 2rem;
}

.avatar-frame {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 4px solid var(--gold);
}

.spell-nav {
  display: flex;
  gap: 1rem;
}

.spell-btn {
  padding: 0.8rem 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--gold);
  color: var(--gold);
  cursor: pointer;
  transition: all 0.3s;
}

.spell-btn.active {
  background: var(--gold);
  color: #000;
}

.magic-section {
  display: block;
}

.shop-shelves {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 2rem;
}

.effects-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
}

.toast-effect {
  background: rgba(0,0,0,0.8);
  padding: 2rem;
  border-radius: 15px;
  border: 1px solid var(--gold);
  text-align: center;
}
</style>
