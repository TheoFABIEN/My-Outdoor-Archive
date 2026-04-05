import { defineStore } from "pinia"
import { ref } from "vue"

export const drawModeStore = defineStore("drawMode", () => {
	const objectType = ref("")
	return {
		objectType,
	}
})
