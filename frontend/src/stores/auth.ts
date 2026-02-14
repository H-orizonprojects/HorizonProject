import { defineStore } from 'pinia';
import axios from 'axios';

interface Item {
    _id: string;
    name: string;
    image: string;
    type: string;
    rarity: string;
    price: number;
    description?: string;
}

interface InventorySlot {
    itemId: Item;
    quantity: number;
}

interface User {
    discordId: string;
    username: string;
    avatar: string;
    balance: number;
    roles: string[];
    inventory: InventorySlot[];
}

interface AuthState {
    user: User | null;
    authenticated: boolean;
    loading: boolean;
    error: string | null;
}

export const useAuthStore = defineStore('auth', {
    state: (): AuthState => ({
        user: null,
        authenticated: false,
        loading: false,
        error: null,
    }),
    actions: {
        async checkAuth() {
            this.loading = true;
            try {
                const response = await axios.get('/auth/me');
                if (response.data.authenticated) {
                    this.user = response.data.user;
                    this.authenticated = true;
                } else {
                    this.user = null;
                    this.authenticated = false;
                }
            } catch (err) {
                this.error = 'Auth check failed';
                console.error(err);
            } finally {
                this.loading = false;
            }
        },
        async logout() {
            try {
                await axios.get('/auth/logout');
                this.user = null;
                this.authenticated = false;
                window.location.href = '/';
            } catch (err) {
                console.error('Logout failed', err);
            }
        }
    },
});
