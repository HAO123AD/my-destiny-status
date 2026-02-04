<script setup lang="ts">
import ExchangeCard from '../../../components/exchange-card.vue';
import { useCharacterStore } from '../../../store/character';

const characterStore = useCharacterStore();

const pointsToExchange = ref(0);

const maxExchangeable = computed(() => {
  const currentSpent = Math.ceil(characterStore.character.destinyPoints / 2);
  return Math.max(
    0,
    characterStore.character.reincarnationPoints - (characterStore.consumedPoints - currentSpent),
  );
});

const handleExchange = () => {
  if (pointsToExchange.value <= 0 || pointsToExchange.value > maxExchangeable.value) {
    return;
  }

  const nextDestinyPoints = Math.max(0, Math.round(pointsToExchange.value)) * 2;
  characterStore.updateCharacterField('destinyPoints', nextDestinyPoints);
  pointsToExchange.value = 0;
};

const handleExchangeAll = () => {
  if (maxExchangeable.value <= 0) return;
  characterStore.updateCharacterField('destinyPoints', maxExchangeable.value * 2);
  pointsToExchange.value = 0;
};

const handleReset = () => {
  characterStore.resetDestinyExchange();
  pointsToExchange.value = 0;
};
</script>

<template>
  <ExchangeCard
    v-model="pointsToExchange"
    title="命运点数"
    rate-text="(1转生点 = 2命运点)"
    icon-class="fa-solid fa-stars"
    current-label="当前："
    :current-value="characterStore.character.destinyPoints"
    gain-unit="命运点"
    :gain-per-point="2"
    :max-exchangeable="maxExchangeable"
    theme="violet"
    exchange-all-title="将所有剩余转生点数兑换为命运点数"
    reset-title="重置已兑换的命运点数"
    :reset-disabled="characterStore.character.destinyPoints <= 0"
    @exchange="handleExchange"
    @exchange-all="handleExchangeAll"
    @reset="handleReset"
  />
</template>
