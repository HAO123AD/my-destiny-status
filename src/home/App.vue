<template>
  <div class="selector-scroll">
    <ShowcaseSection />

    <div class="step-content">
      <Transition name="fade" mode="out-in">
        <component
          :is="steps[currentStep]"
          @next="nextStep"
          @prev="prevStep"
          @env-check-complete="handleEnvCheckComplete"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { provide, readonly, ref } from 'vue';
import CorePage from './components/CorePage.vue';
import DLCManagementPage from './components/DLCManagementPage.vue';
import EnvCheckPage from './components/EnvCheckPage.vue';
import ShowcaseSection from './components/ShowcaseSection.vue';
import StartPage from './components/StartPage.vue';

const currentStep = ref(0);

const steps = [EnvCheckPage, DLCManagementPage, CorePage, StartPage];

// 环境检查结果
const envCheckResult = ref(null);

// 提供给子组件使用
provide('envCheckResult', readonly(envCheckResult));

function nextStep() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

function handleEnvCheckComplete(result) {
  envCheckResult.value = result;
}
</script>

<style scoped>
.selector-scroll {
  background-color: #f5efe6;
  max-width: 900px;
  width: 100%;
  margin: auto;
  display: flex;
  flex-direction: column;
}

.step-content {
  margin-top: 20px;
}
</style>
