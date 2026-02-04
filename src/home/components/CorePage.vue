<template>
  <div class="core-page">
    <h2 class="main-title">核心选择</h2>

    <div class="control-panel-container">
      <!-- Tab 导航 -->
      <div class="tab-navigation">
        <button
          v-if="showArrows"
          class="arrow-button"
          :disabled="tabStartIndex === 0"
          title="上一页"
          @click="handlePrevTabs"
        >
          <span>‹</span>
        </button>
        <div class="tab-buttons-container">
          <button
            v-for="tab in visibleTabs"
            :key="tab"
            class="tab-button"
            :class="{
              active: activeTab === tab,
              'special-recommend-tab': tab === SPECIAL_RECOMMEND_TAB,
            }"
            @click="activeTab = tab"
          >
            <span class="tab-label">{{ tab }}</span>
            <span v-if="tab !== SPECIAL_RECOMMEND_TAB" class="tab-count"
              >({{ getCoresForTab(tab).length }})</span
            >
          </button>
        </div>
        <button
          v-if="showArrows"
          class="arrow-button"
          :disabled="tabStartIndex + maxVisibleTabs >= tabs.length"
          title="下一页"
          @click="handleNextTabs"
        >
          <span>›</span>
        </button>
        <button
          class="refresh-button"
          :disabled="isLoading"
          title="刷新核心列表"
          @click="handleRefresh"
        >
          <span :class="{ 'is-spinning': isLoading }">⟳</span>
        </button>
      </div>

      <div class="tab-content">
        <div class="control-group">
          <div v-if="isLoading" class="loading-text">正在加载核心列表...</div>
          <div v-else-if="coreOptions.length === 0" class="empty-text">未找到可用的核心</div>
          <!-- 特别推荐显示 - 特殊卡片布局 -->
          <div v-else-if="isSpecialRecommendTab" class="special-recommend-container">
            <div class="recommend-hero-section">
              <div class="hero-icon">✦</div>
              <div class="hero-content">
                <h3 class="hero-title">本周精选</h3>
                <p class="hero-subtitle">由<s>社区</s>与编辑共同甄选的优质(?)核心</p>
              </div>
              <div class="hero-divider"></div>
            </div>
            <div class="special-recommend-cards">
              <div
                v-for="recommendCore in specialRecommendCoreList"
                :key="recommendCore.value"
                class="special-recommend-card"
                :class="{
                  unavailable: !recommendCore.available,
                  selected: selectedCore === recommendCore.value,
                }"
                @click="recommendCore.available && handleSelectCore(recommendCore.value)"
              >
                <div v-if="!recommendCore.available" class="card-overlay"></div>
                <div class="card-content">
                  <div class="card-label">{{ recommendCore.label }}</div>
                  <div v-if="recommendCore.author" class="card-author">
                    {{ recommendCore.author }}
                  </div>
                  <div class="card-note">
                    <template v-if="!recommendCore.available">不可用</template>
                    <template v-else-if="recommendCore.specialNote">{{
                      recommendCore.specialNote
                    }}</template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 普通核心显示 -->
          <div v-else class="control-buttons">
            <div
              v-for="core in getCoresForTab(activeTab)"
              :key="core.value"
              class="control-item-wrapper"
            >
              <button
                class="control-button"
                :class="{ selected: selectedCore === core.value }"
                @click="handleSelectCore(core.value)"
              >
                {{ core.label }}
              </button>
              <div v-if="core.author" class="core-author">{{ core.author }}</div>
              <div v-if="core.note" class="core-note">
                {{ core.note }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="step-footer">
      <button class="nav-button" :disabled="isSaving" @click="$emit('prev')">
        <span>上一步</span>
      </button>
      <button class="nav-button" :disabled="isLoading || isSaving" @click="handleNext">
        <span>{{ isSaving ? '保存中...' : '下一步' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  getCoresForTab as getCoresForTabService,
  getSelectedCore,
  initialCoreState,
  loadCoreOptions as loadCoreOptionsService,
  loadSpecialRecommendCores,
  saveChanges as saveChangesService,
  selectCore,
  SPECIAL_RECOMMEND_TAB,
  type CoreOption,
  type SpecialRecommendCore,
} from '../services/CorePage';

const emit = defineEmits<{
  prev: [];
  next: [];
}>();

const isLoading = ref(false);
const isSaving = ref(false);
const tabs = ref<string[]>([...initialCoreState.tabs]);
const activeTab = ref<string>(initialCoreState.activeTab);
const coreOptions = ref<CoreOption[]>([...initialCoreState.coreOptions]);
const localCoreSelections = ref(new Map(initialCoreState.localCoreSelections));
const bookName = ref<string | null>(null);
const specialRecommendCoreList = ref<SpecialRecommendCore[]>([]);

// Tab 分页相关
const maxVisibleTabs = 4;
const tabStartIndex = ref(0);

const selectedCore = computed(() => getSelectedCore(localCoreSelections.value));

// 当前是否在特别推荐tab
const isSpecialRecommendTab = computed(() => activeTab.value === SPECIAL_RECOMMEND_TAB);

// 是否显示箭头
const showArrows = computed(() => tabs.value.length > maxVisibleTabs);

// 当前可见的 tabs
const visibleTabs = computed(() => {
  if (!showArrows.value) {
    return tabs.value;
  }
  return tabs.value.slice(tabStartIndex.value, tabStartIndex.value + maxVisibleTabs);
});

// 切换到上一批 tabs
function handlePrevTabs() {
  if (tabStartIndex.value > 0) {
    tabStartIndex.value = Math.max(0, tabStartIndex.value - maxVisibleTabs);
  }
}

// 切换到下一批 tabs
function handleNextTabs() {
  if (tabStartIndex.value + maxVisibleTabs < tabs.value.length) {
    tabStartIndex.value = Math.min(
      tabs.value.length - maxVisibleTabs,
      tabStartIndex.value + maxVisibleTabs,
    );
  }
}

// 当 activeTab 改变时，确保它在可见范围内
watch(activeTab, newTab => {
  const tabIndex = tabs.value.indexOf(newTab);
  if (tabIndex !== -1 && showArrows.value) {
    if (tabIndex < tabStartIndex.value) {
      tabStartIndex.value = tabIndex;
    } else if (tabIndex >= tabStartIndex.value + maxVisibleTabs) {
      tabStartIndex.value = tabIndex - maxVisibleTabs + 1;
    }
  }
});

function getCoresForTab(tab: string): CoreOption[] {
  return getCoresForTabService(coreOptions.value, tab);
}

async function loadCoreOptions() {
  isLoading.value = true;
  try {
    // 从远程加载特别推荐核心数据
    const specialRecommendCoresData = await loadSpecialRecommendCores();
    const result = await loadCoreOptionsService(specialRecommendCoresData);
    tabs.value = result.tabs;
    coreOptions.value = result.coreOptions;
    localCoreSelections.value = result.localCoreSelections;
    activeTab.value = result.activeTab;
    bookName.value = result.bookName;
    specialRecommendCoreList.value = result.specialRecommendCoreList;
  } catch (error) {
    console.error('加载核心列表失败:', error);
    tabs.value = [];
    coreOptions.value = [];
    localCoreSelections.value = new Map();
    bookName.value = null;
    specialRecommendCoreList.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function handleRefresh() {
  await loadCoreOptions();
}

function handleSelectCore(coreValue: string) {
  localCoreSelections.value = selectCore(localCoreSelections.value, coreValue);
}

/**
 * 点击下一步：根据本地列表更新世界书后跳转
 */
async function handleNext() {
  isSaving.value = true;
  try {
    if (bookName.value) {
      coreOptions.value = await saveChangesService(
        coreOptions.value,
        localCoreSelections.value,
        bookName.value,
      );
    }
  } catch (error) {
    console.error('保存核心选择失败:', error);
  } finally {
    isSaving.value = false;
  }
  emit('next');
}

// 组件挂载时加载核心列表
onMounted(() => {
  loadCoreOptions();
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

.control-panel-container {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: rgba(253, 250, 245, 0.9);
  padding: 0;
  margin: 25px 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

/* Tab 导航样式 */
.tab-navigation {
  display: flex;
  align-items: stretch;
  background-color: var(--item-bg-color);
  border-bottom: 1px solid var(--border-color);
}

.arrow-button {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--border-color);
  cursor: pointer;
  font-size: 1.5em;
  color: var(--text-color);
  opacity: 0.7;
  transition: all 0.2s ease-in-out;
}

.arrow-button:last-of-type {
  border-right: none;
  border-left: 1px solid var(--border-color);
}

.arrow-button:hover:not(:disabled) {
  opacity: 1;
  background-color: var(--item-bg-hover-color);
}

.arrow-button:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

.tab-buttons-container {
  flex: 1;
  display: flex;
  align-items: stretch;
}

.tab-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-family: var(--body-font);
  font-size: 1em;
  color: var(--text-color);
  opacity: 0.7;
  transition: all 0.2s ease-in-out;
}

.tab-button:hover {
  opacity: 1;
  background-color: var(--item-bg-hover-color);
}

.tab-button.active {
  color: var(--title-color);
  opacity: 1;
  border-bottom-color: var(--title-color);
}

.tab-label {
  font-weight: 500;
}

.tab-count {
  font-size: 0.85em;
  opacity: 0.8;
}

.refresh-button {
  flex: 0 0 auto;
  background: transparent;
  border: none;
  border-left: 1px solid var(--border-color);
  padding: 12px 16px;
  cursor: pointer;
  font-size: 1.2em;
  color: var(--text-color);
  opacity: 0.7;
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
}

.refresh-button:hover:not(:disabled) {
  opacity: 1;
  background-color: var(--item-bg-hover-color);
}

.refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.refresh-button .is-spinning {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.tab-content {
  padding: 15px 20px;
  height: 450px;
  overflow-y: auto;
}

.control-group {
  min-height: 100%;
}

.control-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border-color);
}

.control-group-title {
  font-weight: 500;
  color: var(--title-color);
  margin: 0;
  font-size: 1.1em;
}

.control-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.control-item-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1 0 140px;
  max-width: 280px;
}

.control-button {
  font-family: var(--body-font);
  font-size: 0.95em;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  background-color: var(--item-bg-color);
  color: var(--text-color);
  opacity: 0.8;
  width: 100%;
}

.control-button:hover {
  background-color: var(--item-bg-hover-color);
  border-color: var(--border-strong-color);
  opacity: 1;
}

.control-button.selected {
  background-color: var(--item-bg-selected-color);
  border-color: var(--title-color);
  color: var(--title-color);
  font-weight: 500;
  opacity: 1;
}

/* 核心作者样式 */
.core-author {
  font-size: 0.85em;
  color: #8b7355;
  text-align: center;
  margin-top: 4px;
  font-style: italic;
}

/* 核心备注样式 */
.core-note {
  font-size: 0.8em;
  color: #6a514d;
  text-align: center;
  margin-top: 4px;
  padding: 4px 8px;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
  width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

/* 特别推荐容器样式 */
.special-recommend-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center; /* 垂直居中 */
  padding: 5px 0 20px 0; /* 减少顶部内边距 */
  height: 100%; /* 占满父容器高度 */
  min-height: 400px; /* 保证最小高度 */
}

.recommend-hero-section {
  text-align: center;
  margin-bottom: 5px; /* 减少与卡片的间距 */
  animation: fadeIn 0.6s ease-out;
}

.hero-icon {
  font-size: 24px;
  color: #d4a574;
  margin-bottom: 8px;
  opacity: 0.8;
}

.hero-title {
  font-family: var(--title-font);
  font-size: 1.4em;
  color: var(--title-color);
  margin: 0 0 6px 0;
  font-weight: 600;
  letter-spacing: 1px;
}

.hero-subtitle {
  font-family: var(--body-font);
  font-size: 0.9em;
  color: #8b7355;
  margin: 0;
  opacity: 0.8;
}

.hero-divider {
  width: 40px;
  height: 2px;
  background-color: #d4a574;
  margin: 15px auto 0;
  opacity: 0.4;
}

.special-recommend-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.special-recommend-icon {
  font-size: 1.2em;
  color: #d4a574;
}

.special-recommend-title {
  font-size: 1.3em;
  font-weight: 600;
  color: var(--title-color);
  letter-spacing: 2px;
}

.special-recommend-cards {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: nowrap; /* 强制不换行 */
  width: 100%;
}

.special-recommend-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 使用flex让卡片自适应宽度 */
  flex: 1 1 0;
  max-width: 200px;
  min-width: 150px;
  aspect-ratio: 3 / 4; /* 3:4 长方形比例 */
  padding: 20px 16px;
  background: linear-gradient(135deg, #fdf8f3 0%, #f5ebe0 100%);
  border: 2px solid #d4a574;
  border-radius: 12px;
  box-shadow: 0 6px 16px rgba(139, 115, 85, 0.12);
  cursor: pointer;
  transition: all 0.3s ease;
}

.special-recommend-card:hover:not(.unavailable) {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(139, 115, 85, 0.25);
  border-color: #c69c6d;
}

.special-recommend-card.selected {
  border-color: var(--title-color);
  background: linear-gradient(135deg, #f5ebe0 0%, #ede0d4 100%);
  box-shadow: 0 4px 16px rgba(139, 115, 85, 0.3);
}

.special-recommend-card.unavailable {
  cursor: not-allowed;
  opacity: 0.7;
  filter: grayscale(40%);
}

.special-recommend-card.unavailable:hover {
  transform: none;
  box-shadow: 0 4px 12px rgba(139, 115, 85, 0.15);
}

.card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(128, 128, 128, 0.15);
  border-radius: 12px;
  pointer-events: none;
  z-index: 1;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  margin-top: 8px;
  z-index: 2;
  position: relative;
}

.card-label {
  font-size: 1.35em; /* 原为 1.1em */
  font-weight: 700;
  color: var(--title-color);
  line-height: 1.3;
  margin-bottom: 6px;
}

/* 增大作者字体 */
.card-author {
  font-size: 0.95em; /* 原为 0.85em */
  color: #8b7355;
  font-style: italic;
  margin-bottom: 8px;
}

/* 优化备注样式 */
.card-note {
  font-size: 0.9em; /* 原为 0.8em */
  color: #6a514d;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  margin-top: 8px;
  line-height: 1.5;
  width: 100%; /* 确保备注背景占满 */
  box-sizing: border-box;
}

/* 添加一个简单的淡入动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.special-recommend-card.unavailable .card-note {
  color: #999;
  font-style: italic;
}

.loading-text,
.empty-text {
  font-size: 0.95em;
  color: #6a514d;
  text-align: center;
  padding: 20px;
  opacity: 0.8;
}

.step-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 20px;
}

.nav-button {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--body-font);
  font-weight: 500;
  font-size: 1em;
  color: var(--title-color);
  background-color: var(--item-bg-color);
  border: 1px solid var(--border-color);
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.nav-button:hover:not(:disabled) {
  background-color: var(--item-bg-hover-color);
  border-color: var(--border-strong-color);
  transform: translateY(-2px);
}

.nav-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-icon {
  font-size: 1.1em;
}

@media screen and (max-width: 600px) {
  .main-title {
    font-size: 1.8em;
  }

  .control-item-wrapper {
    flex-basis: 100%;
    max-width: 100%;
  }

  .tab-button {
    padding: 10px 8px;
    font-size: 0.85em;
  }

  .arrow-button {
    padding: 10px 12px;
    font-size: 1.2em;
  }

  .refresh-button {
    padding: 10px 12px;
  }

  /* 特别推荐卡片移动端适配 */
  .special-recommend-container {
    min-height: auto;
    padding: 10px 0;
  }

  .special-recommend-cards {
    flex-wrap: wrap;
    gap: 16px;
  }

  .special-recommend-card {
    flex: 1 1 100%;
    max-width: 100%;
    min-width: auto;
    aspect-ratio: 4 / 3;
    padding: 16px 12px;
  }

  .hero-title {
    font-size: 1.2em;
  }

  .card-label {
    font-size: 1.2em;
  }
}
</style>
