<template>
  <div class="env-check-page">
    <h2 class="main-title">环境检查</h2>

    <!-- 环境检查部分 -->
    <div class="env-check-container">
      <!-- 酒馆助手 -->
      <div class="env-check-item">
        <div class="env-check-label">
          <span class="icon">⚙️</span>
          <span>酒馆助手</span>
        </div>
        <div class="env-check-details">
          <span
            >版本:
            <strong :class="'status-' + (envStatus.tavernHelper.version ? 'ok' : 'unknown')">
              {{ envStatus.tavernHelper.version || '未知' }}
            </strong></span
          >
          <span
            >状态:
            <strong :class="'status-' + envStatus.tavernHelper.status">
              {{ envStatus.tavernHelper.statusText }}
            </strong></span
          >
        </div>
      </div>

      <!-- 提示词模板 (EJS) -->
      <div class="env-check-item">
        <div class="env-check-label">
          <span class="icon">📄</span>
          <span>提示词模板 (EJS)</span>
        </div>
        <div class="env-check-details">
          <span
            >状态:
            <strong :class="'status-' + envStatus.ejsTemplate.status">
              {{ envStatus.ejsTemplate.statusText }}
            </strong></span
          >
          <span
            >启用?:
            <strong :class="'status-' + envStatus.ejsTemplate.enabledStatus">
              {{ envStatus.ejsTemplate.enabledText }}
            </strong></span
          >
        </div>
      </div>

      <!-- MVU 框架 -->
      <div class="env-check-item">
        <div class="env-check-label">
          <span class="icon">🧩</span>
          <span>MVU 框架</span>
        </div>
        <div class="env-check-details">
          <span
            >状态:
            <strong :class="'status-' + envStatus.mvu.status">
              {{ envStatus.mvu.statusText }}
            </strong></span
          >
        </div>
      </div>

      <div class="recheck-container">
        <button class="recheck-button" :disabled="isChecking" @click="performCheck">
          {{ isChecking ? '检查中...' : '重新检查' }}
        </button>
      </div>
    </div>

    <!-- 检查通过提示 -->
    <transition name="fade">
      <div v-if="envStatus.allOk && !isChecking" class="success-message">
        <span class="success-icon">✅</span>
        <span>环境检查通过，正在跳转...</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { initialEnvStatus, performFullEnvCheck } from '../services/envCheck';

const emit = defineEmits(['next', 'envCheckComplete']);

const isChecking = ref(false);

const envStatus = ref({ ...initialEnvStatus });

async function performCheck() {
  isChecking.value = true;

  try {
    const result = await performFullEnvCheck();
    envStatus.value = result;
    emit('envCheckComplete', result);
  } catch (error) {
    console.error('环境检查失败:', error);
  } finally {
    isChecking.value = false;
  }
}

// 监听环境检查状态，检查通过后自动跳转到下一页
watch(
  () => envStatus.value.allOk,
  allOk => {
    if (allOk && !isChecking.value) {
      emit('next');
    }
  },
);

onMounted(() => {
  performCheck();
});
</script>

<style scoped>
.main-title {
  font-family: var(--title-font);
  font-weight: 700;
  color: var(--title-color);
  text-align: center;
  margin: 0 0 10px 0;
  font-size: 2.2em;
}

.env-check-container {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: rgba(253, 250, 245, 0.9);
  padding: 10px 20px;
  margin: 25px 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.env-check-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 5px;
  flex-wrap: wrap;
  gap: 10px;
}

.env-check-item:not(:last-child) {
  border-bottom: 1px dashed var(--border-color);
}

.env-check-label {
  display: flex;
  align-items: center;
  font-weight: 500;
  color: var(--title-color);
}

.env-check-label .icon {
  font-size: 1.4em;
  margin-right: 12px;
  opacity: 0.8;
  line-height: 1;
}

.env-check-details {
  display: flex;
  align-items: center;
  font-size: 0.9em;
  gap: 15px;
  text-align: right;
}

.env-check-details strong {
  font-weight: 700;
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  min-width: 55px;
  text-align: center;
  border: 1px solid transparent;
}

/* 淡入淡出过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.recheck-container {
  text-align: center;
  margin: 15px 0 0 0;
}

.recheck-button {
  font-family: var(--body-font);
  font-weight: 500;
  font-size: 1em;
  color: var(--title-color);
  background-color: var(--item-bg-color);
  border: 1px solid var(--border-color);
  padding: 8px 25px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.recheck-button:hover:not(:disabled) {
  background-color: var(--item-bg-hover-color);
  border-color: var(--border-strong-color);
}

.recheck-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  margin-top: 15px;
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 6px;
  color: #155724;
  font-weight: 500;
}

.success-icon {
  font-size: 1.2em;
}

@media screen and (max-width: 600px) {
  .main-title {
    font-size: 1.8em;
  }
}
</style>
