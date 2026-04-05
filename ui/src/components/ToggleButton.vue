<template>
    <label class="toggle">
        <span class="label-text">{{label}}</span>
        <input type="checkbox" :id="id" v-model="model">
        <span class="slider" :class="sliderClass"></span>
    </label>
</template>

<script setup>
defineProps({
    id: {
        type: String,
        required: true
    },
    label: {
        type: String,
        required: true
    },
    sliderClass: {
        type: String,
        required: true
    },
})
const model = defineModel({type: Boolean, default: true})
</script>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  cursor: pointer;
}

.toggle input {
  display: none;
}
.slider {
  width: 46px;
  height: 24px;
  background: var(--ui-border);
  border-radius: 12px;
  position: relative;
  transition: 0.3s;
}
.slider::before {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  top: 2px;
  left: 2px;
  border-radius: 50%;
  background: white;
  transition: 0.3s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.toggle input:checked + .slider::before {
  transform: translateX(22px);
}
#toggleGPX:checked + .slider { background: var(--toggle-gpx); }
#togglePoints:checked + .slider { background: var(--toggle-points); }
#toggleAreas:checked + .slider { background: var(--toggle-areas); }
</style>