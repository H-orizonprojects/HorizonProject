<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const isLocked = ref(true);
const showContent = ref(false);

const unlock = () => {
  isLocked.value = false;
  setTimeout(() => {
    showContent.value = true;
  }, 100);
};

onMounted(() => {
  auth.checkAuth();
});
</script>

<template>
  <div v-if="isLocked" id="lock-screen" @click="unlock">
    <div class="lock-container">
      <svg class="chain-svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" class="lock-path" />
      </svg>
      <div class="lock-btn-container">
        <img src="@/assets/images/Eternal.png" class="lock-icon" alt="Lock">
      </div>
    </div>
    <div class="lock-status cinzel text-glow-gold">Touch to Unlock Eternity</div>
  </div>

  <main v-if="!isLocked" id="main-content" :class="{ 'fade-in': showContent }">
    <div id="auth-container">
      <div v-if="auth.authenticated" class="glass auth-logged-in">
        <img :src="`https://cdn.discordapp.com/avatars/${auth.user?.discordId}/${auth.user?.avatar}.png`" alt="Avatar" class="avatar">
        <span class="cinzel gold-text">{{ auth.user?.username }}</span>
        <router-link to="/dashboard" class="cinzel dashboard-link">Dashboard</router-link>
        <a href="#" @click.prevent="auth.logout" class="logout-link">Logout</a>
      </div>
      <a v-else href="/auth/discord" class="glass login-btn">
        <img src="@/assets/images/RCT.png" alt="Discord" class="btn-icon">
        <span class="cinzel">Login</span>
      </a>
    </div>

    <section class="story-section">
      <h1 class="text-glow-gold">ETERNITY</h1>
      <div class="story-text">
        <p>โลกซึ่งกาลเวลาไม่อาจพราก และเรื่องราวไม่เคยดับสูญ
          ที่แห่งนี้ดำรงอยู่ได้ด้วยถ้อยคำ ความทรงจำ และนิทานอันไร้ขอบเขต
          ทุกบทบันทึกคือเศษเสี้ยวของตัวตน ทุกเรื่องเล่าคือแรงผลักดันให้โลกยังคงหายใจ</p>
      </div>
    </section>

    <div class="navigation-grid">
      <div class="part-card glass library-card">
        <h2 class="cinzel">I : Winchester Library</h2>
        <p>ณ ใจกลางของความนิรันดร์
          Winchester Library ยืนหยัดราวประตูสู่เรื่องราวทั้งปวง
          รวบรวมตำนาน ความฝัน และชะตากรรมที่ถูกจารึก
          เพื่อให้ผู้มาเยือนได้ค้นพบตนเอง ผ่านหน้ากระดาษที่ไม่มีวันสิ้นสุด</p>
        <a href="/winchester.html" class="btn-enter">Enter Library</a>
      </div>

      <div class="part-card glass house-card">
        <h2 class="cinzel">II : Rachata House</h2>
        <p>ตระกูลเวทมนตร์ผู้พิทักษ์ความลับและความทรงจำ</p>
        <a href="/rachata_house.html" class="btn-enter">Enter House</a>
      </div>

      <div class="part-card glass school-card">
        <h2 class="cinzel">III : Rachata School</h2>
        <p>โรงเรียนพ่อมดแม่มดศาสตร์รชต โรงเรียนสอนเวทมนตร์แห่งประเทศไทย</p>
        <a href="/rachata_school.html" class="btn-enter">Enter School</a>
      </div>
    </div>
  </main>
</template>

<style scoped>
#lock-screen {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #000;
  cursor: pointer;
}

.lock-container {
  position: relative;
  width: 200px;
  height: 200px;
}

.lock-btn-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.lock-icon {
  width: 100px;
  height: 100px;
  transition: transform 0.3s ease;
}

.lock-icon:hover {
  transform: scale(1.1);
}

.lock-path {
  fill: none;
  stroke: var(--gold);
  stroke-width: 2;
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: draw 3s forwards;
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}

#main-content {
  opacity: 0;
  filter: blur(20px);
  transition: opacity 2s ease, filter 2.5s ease;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.8)), url('@/assets/images/Eternity.png');
  background-size: cover;
  background-position: center;
  overflow-y: auto;
  padding: 2rem;
}

#main-content.fade-in {
  opacity: 1;
  filter: blur(0);
}

#auth-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.auth-logged-in {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px 20px;
  border-radius: 30px;
  border: 1px solid var(--gold);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.dashboard-link {
  color: var(--purple-light);
  text-decoration: none;
  margin-left: 10px;
  font-weight: bold;
}

.logout-link {
  color: #ff4444;
  text-decoration: none;
  margin-left: 10px;
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border-radius: 30px;
  color: var(--gold);
  text-decoration: none;
  border: 1px solid var(--gold);
  transition: all 0.3s ease;
}

.btn-icon {
  width: 24px;
  height: 24px;
}

.story-section {
  max-width: 800px;
  text-align: center;
  margin-bottom: 4rem;
}

.story-section h1 {
  font-size: 4rem;
  color: var(--gold);
  margin-bottom: 1rem;
}

.story-text {
  font-size: 1.2rem;
  color: var(--text-light);
  background: rgba(0, 0, 0, 0.6);
  padding: 2rem;
  border-radius: 10px;
  border-left: 4px solid var(--purple);
}

.navigation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  width: 100%;
  max-width: 1200px;
}

.part-card {
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, border-color 0.3s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 350px;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
}

.part-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1;
}

.part-card * {
  position: relative;
  z-index: 2;
}

.part-card:hover {
  transform: translateY(-10px);
  border-color: var(--gold);
}

.library-card { background-image: url('@/assets/images/StoryLamp.png'); }
.house-card { background-image: url('@/assets/images/RachataHouse.png'); }
.school-card { background-image: url('@/assets/images/RachataSchool.png'); }

.part-card h2 {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: var(--gold);
}

.part-card p {
  font-size: 0.9rem;
  opacity: 0.8;
}

.btn-enter {
  margin-top: 1.5rem;
  padding: 0.8rem 1.5rem;
  border: 1px solid var(--gold);
  color: var(--gold);
  text-transform: uppercase;
  letter-spacing: 2px;
  display: inline-block;
  transition: 0.3s;
  text-decoration: none;
}

.btn-enter:hover {
  background: var(--gold);
  color: #000;
}
</style>
