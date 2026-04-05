<template>
<div class="distance-header">
  <p class="secondary-text">Max distance</p>
  <span id="distanceValue">{{distanceLabel}}</span>
</div>
<input type="range"
  id="distanceSlider"
  min="0"
  :max="50"
  step="1"
  v-model.number="store.maxDistance"
>
</template>


<script setup>
import {ref, computed} from 'vue'
import { useFilterStore } from '@/stores/useFilters'
const store = useFilterStore()

const distanceLabel = computed(() => {
    return store.maxDistance === 50
    ? store.maxDistance + "+ km"
    : store.maxDistance + " km"
})
</script>


<style scoped>
.distance-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-top: -20px;
}
#distanceSlider {
    -webkit-appearance: none;
    appearance: none;
    background: var(--ui-grey);
    width: 100%;
    outline: none;
    border-radius: 5px;
    height: 5px;
    margin: 0 auto;
    display: block;
}
#distanceSlider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--ui-darkgreen);
  cursor: pointer;
}
#distanceSlider::-moz-range-thumb {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--ui-darkgreen);
  cursor: pointer;
}
</style>