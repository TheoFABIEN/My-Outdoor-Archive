<script setup>
import { ref } from 'vue'
import Map from "@/components/Map.vue"
import Sidebar from "@/components/Sidebar.vue"
import Modal from "@/components/Modal.vue"

const isModalOpen = ref(false)
const mapRef = ref(null)
function openModal() {
  isModalOpen.value = true
}
function closeModal() {
  isModalOpen.value = false
}
function handleUploaded() {
  mapRef.value?.reloadGPX()
}
</script>

<template>
  <Map ref="mapRef"></Map>
  <Sidebar @openModal="openModal"></Sidebar>
  <Modal 
    v-if="isModalOpen" 
    @close="closeModal"
    @uploaded="handleUploaded"
  ></Modal>
</template>