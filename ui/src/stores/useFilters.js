import { defineStore } from "pinia"
import { ref, computed } from "vue"

export const useFilterStore = defineStore("filters", () => {
	const maxDistance = ref(50)
	const isUnlimited = computed(() => maxDistance.value === 50)
	const selectedDifficulty = ref("")
	const selectedExposure = ref("")
	const showPointsLayer = ref(true)
	const showGpxLayer = ref(true)
	const showAreasLayer = ref(true)

	return {
		maxDistance,
		isUnlimited,
		selectedDifficulty,
		selectedExposure,
		showPointsLayer,
		showGpxLayer,
		showAreasLayer,
	}
})
