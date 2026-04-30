<template>
  <div ref="mapContainer" class="map"></div>

  <MapPopup
    ref="mapPopupRef"
    :visible="interactions?.popupState.visible"
    :item="interactions?.popupState.item"
    :position="interactions?.popupState.position"
    @close="interactions?.closePopup()"
    @edit="onEdit"
    @delete="onDelete"
  />

  <EditModal
    v-if="isEditModalOpen"
    :item="editingItem"
    @close="isEditModalOpen = false"
    @updated="reloadAll"
  />
</template>

<script setup>
import { ref, onMounted, watch, defineExpose } from "vue"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import MapboxDraw from "@mapbox/mapbox-gl-draw"
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"

import { useFilterStore } from "@/stores/useFilters"
import { drawModeStore } from "@/stores/drawMode"
import { getPoints, getAreas, getGPX, addPoint, addArea, deleteItem } from "@/utils/api"
import { useMapLayers } from "@/utils/useMapLayers"
import { useMapInteractions } from "@/utils/useMapInteractions"
import MapPopup from "@/components/MapPopup.vue"
import EditModal from "@/components/EditModal.vue"

const filterStore = useFilterStore()
const drawStore = drawModeStore()
const props = defineProps(["isSidebarOpen", "isMobile"])

const mapContainer = ref(null)
let map = null
let draw = null
let dataLoaded = false

const points = ref([])
const areas = ref([])
const gpx = ref([])

const editingItem = ref(null)
const isEditModalOpen = ref(false)
const pendingJump = ref(null)
const mapPopupRef = ref(null)

const layers = ref(null)
const interactions = ref(null)

const is3D = ref(false)

// ── Edit / Delete ─────────────────────────────────────────────────
function onEdit(item) {
  editingItem.value = { ...item, type: item.type ?? item.itemType }
  isEditModalOpen.value = true
  interactions.value.closePopup()
}

async function onDelete(item) {
  if (!confirm("Delete this element ?")) return
  try {
    await deleteItem(item.itemType, item.id)
    if (item.itemType === "points") { points.value = await getPoints(); layers.value.renderPoints(points.value) }
    if (item.itemType === "areas") { areas.value = await getAreas(); layers.value.renderAreas(areas.value) }
    if (item.itemType === "gpx_hikes") { gpx.value = await getGPX(); layers.value.renderGPX(gpx.value) }
    interactions.value.closePopup()
  } catch (err) { console.error(err) }
}

// ── 3D terrain ────────────────────────────────────────────────────
function enable3D() {
  map.setTerrain({ source: "terrain", exaggeration: 1.5 })
  map.easeTo({ pitch: 60, duration: 800 })
  is3D.value = true
}

function disable3D() {
  map.setTerrain(null)
  map.easeTo({ pitch: 0, bearing: 0, duration: 800 })
  is3D.value = false
}

function toggle3D() {
  is3D.value ? disable3D() : enable3D()
}

// ── Draw mode ─────────────────────────────────────────────────────
function initDraw() {
  draw = new MapboxDraw({
    displayControlsDefault: false,
    styles: [
      {
        id: "gl-draw-polygon-fill",
        type: "fill",
        filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
        paint: { "fill-color": "orange", "fill-opacity": 0.5 }
      },
      {
        id: "gl-draw-polygon-stroke",
        type: "line",
        filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
        paint: { "line-color": "orange", "line-width": 2 }
      },
      {
        id: "gl-draw-polygon-and-line-vertex",
        type: "circle",
        filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
        paint: { "circle-radius": 6, "circle-color": "white", "circle-stroke-color": "orange", "circle-stroke-width": 2 }
      },
      {
        id: "gl-draw-line",
        type: "line",
        filter: ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
        paint: { "line-color": "orange", "line-width": 2, "line-dasharray": [2, 2] }
      }
    ]
  })
  map.addControl(draw)
}

async function handleAddPoint(e) {
  if (e.defaultPrevented) return
  const { lat, lng } = e.lngLat
  const name = prompt("Name of this place?")
  if (!name) { cancelDraw(); return }
  const notes = prompt("Notes?") || ""
  try {
    await addPoint({ name, notes, lat, lon: lng })
    points.value = await getPoints()
    layers.value.renderPoints(points.value)
  } catch (err) { console.error(err) }
  cancelDraw()
}

async function handleAreaCreated(e) {
  const geojson = e.features[0]
  const name = prompt("Name of this area?")
  if (!name) { draw.deleteAll(); cancelDraw(); return }
  const notes = prompt("Notes?") || ""
  try {
    await addArea({ name, notes, geometry: geojson.geometry })
    areas.value = await getAreas()
    layers.value.renderAreas(areas.value)
  } catch (err) { console.error(err) }
  draw.deleteAll()
  cancelDraw()
}

function cancelDraw() {
  map.getCanvas().style.cursor = ""
  drawStore.objectType = ""
  map.off("click", handleAddPoint)
  map.off("draw.create", handleAreaCreated)
}

watch(
  () => drawStore.objectType,
  async (mode) => {
    if (!map) return
    map.off("click", handleAddPoint)
    map.off("draw.create", handleAreaCreated)
    draw?.deleteAll()
    draw?.changeMode("simple_select")
    map.getCanvas().style.cursor = ""

    if (mode === "point") {
      map.getCanvas().style.cursor = "crosshair"
      map.once("click", handleAddPoint)
    }
    if (mode === "area") {
      map.getCanvas().style.cursor = "crosshair"
      if (!map.isStyleLoaded()) {
        await new Promise(resolve => map.once("style.load", resolve))
      }
      draw.changeMode("draw_polygon")
      map.on("draw.create", handleAreaCreated)
    }
  }
)

// ── Geolocation ───────────────────────────────────────────────────
function locateUser() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    map.flyTo({ center: [coords.longitude, coords.latitude], zoom: 9 })
  })
}

// ── fitBounds ─────────────────────────────────────────────────────
function fitMapToData() {
  const allCoords = []
  points.value.forEach((p) => allCoords.push([p.lon, p.lat]))
  areas.value.forEach((a) => JSON.parse(a.geom).coordinates[0].forEach((c) => allCoords.push(c)))
  gpx.value.forEach((h) => JSON.parse(h.geom).coordinates.forEach((c) => allCoords.push(c)))
  if (!allCoords.length) { map.setCenter([6.868, 45.924]); map.setZoom(6); return }
  const bounds = allCoords.reduce(
    (b, c) => b.extend(c),
    new maplibregl.LngLatBounds(allCoords[0], allCoords[0])
  )
  map.fitBounds(bounds, { padding: 50 })
}

// ── flyToResult ───────────────────────────────────────────────────
function flyToResult({ bbox, center }) {
  if (bbox) {
    map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, maxZoom: 14 })
  } else {
    map.flyTo({ center, zoom: 12 })
  }
}

// ── Basemaps ──────────────────────────────────────────────────────
const BASEMAPS = [
  {
    id: "osm", label: "🌍", maxZoom: 18,
    style: {
      version: 8,
      sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' } },
      layers: [{ id: "osm-layer", type: "raster", source: "osm" }],
    },
  },
  {
    id: "topo", label: "🗺", maxZoom: 16,
    style: {
      version: 8,
      sources: { topo: { type: "raster", tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 17, attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> · © OpenStreetMap contributors' } },
      layers: [{ id: "topo-layer", type: "raster", source: "topo" }],
    },
  },
  {
    id: "satellite", label: "📷", maxZoom: 19,
    style: {
      version: 8,
      sources: { ign: { type: "raster", tiles: ["https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"], tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.ign.fr">IGN Géoportail</a>' } },
      layers: [{ id: "satellite-layer", type: "raster", source: "ign" }],
    },
  },
]

const currentBasemap = ref(BASEMAPS[0])

// ── BasemapControl ────────────────────────────────────────────────
class BasemapControl {
  onAdd(m) {
    this._map = m
    this._container = document.createElement("div")
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group basemap-control"
    this._render()
    return this._container
  }
  onRemove() {
    this._container.parentNode?.removeChild(this._container)
    this._map = null
  }
  _render() {
    this._container.innerHTML = ""
    BASEMAPS.forEach((bm) => {
      const btn = document.createElement("button")
      btn.textContent = bm.label
      btn.title = bm.label
      btn.className = "basemap-btn" + (currentBasemap.value.id === bm.id ? " active" : "")
      btn.onclick = () => switchBasemap(bm)
      this._container.appendChild(btn)
    })
    const sep = document.createElement("div")
    sep.className = "basemap-sep"
    this._container.appendChild(sep)
    const btn3d = document.createElement("button")
    btn3d.textContent = "3D"
    btn3d.title = is3D.value ? "Disable 3D relief" : "Enable 3D relief"
    btn3d.className = "basemap-btn" + (is3D.value ? " active" : "")
    btn3d.onclick = () => { toggle3D(); this.refresh() }
    this._container.appendChild(btn3d)
  }
  refresh() { this._render() }
}

let basemapControl = null

function switchBasemap(bm) {
  if (currentBasemap.value.id === bm.id) return
  const center = map.getCenter()
  const zoom = Math.min(map.getZoom(), bm.maxZoom)
  const bearing = map.getBearing()
  const pitch = map.getPitch()
  currentBasemap.value = bm
  map.setMaxZoom(bm.maxZoom)
  map.setStyle(bm.style)
  pendingJump.value = { center, zoom, bearing, pitch }
}

// ── onMounted ─────────────────────────────────────────────────────
onMounted(async () => {
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: currentBasemap.value.style,
    center: [6.868, 45.924],
    zoom: 6,
    maxZoom: currentBasemap.value.maxZoom,
    pixelRatio: window.devicePixelRatio || 1,
  })
  map.dragRotate.disable()
  map.touchZoomRotate.disableRotation()
  layers.value = useMapLayers(map)
  interactions.value = useMapInteractions(map, mapPopupRef)

  map.addControl(new maplibregl.NavigationControl(), "bottom-right")
  basemapControl = new BasemapControl()
  map.addControl(basemapControl, "bottom-right")

  initDraw()

  const dataPromise = Promise.all([getPoints(), getAreas(), getGPX()])
    .then(([p, a, g]) => {
      points.value = p
      areas.value = a
      gpx.value = g
      dataLoaded = true
    })

  map.on("style.load", async () => {
    await layers.value.loadMapIcons()
    layers.value.initSourcesAndLayers()

    if (!map.getSource("terrain")) {
      map.addSource("terrain", {
        type: "raster-dem",
        tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
        tileSize: 256,
        encoding: "terrarium",
        maxzoom: 14,
      })
    }

    interactions.value.setupLayerInteractions()
    interactions.value.trackPopupOnMove()

    if (!dataLoaded) await dataPromise

    layers.value.renderPoints(points.value)
    layers.value.renderAreas(areas.value)
    layers.value.renderGPX(gpx.value)

    if (pendingJump.value) {
      const { center, zoom, bearing, pitch } = pendingJump.value
      map.jumpTo({ center, zoom, bearing, pitch })
      pendingJump.value = null
    } else {
      fitMapToData()
    }

    basemapControl?.refresh()

    if (is3D.value) {
      map.setTerrain({ source: "terrain", exaggeration: 1.5 })
    }

    layers.value.applyLayerVisibility(
      filterStore.showPointsLayer,
      filterStore.showAreasLayer,
      filterStore.showGpxLayer
    )
  })

  locateUser()
})

// ── Reload ────────────────────────────────────────────────────────
async function reloadGPX() {
  gpx.value = await getGPX()
  if (map?.isStyleLoaded()) layers.value.renderGPX(gpx.value)
}

async function reloadAll() {
  points.value = await getPoints()
  areas.value = await getAreas()
  gpx.value = await getGPX()
  if (map?.isStyleLoaded()) {
    layers.value.renderPoints(points.value)
    layers.value.renderAreas(areas.value)
    layers.value.renderGPX(gpx.value)
  }
}

function invalidateSize() { if (map) map.resize() }
defineExpose({ reloadGPX, invalidateSize, flyToResult, toggle3D })

// ── Watchers ──────────────────────────────────────────────────────
watch(
  () => [filterStore.maxDistance, filterStore.selectedDifficulty, filterStore.selectedExposure],
  () => { if (map?.isStyleLoaded()) layers.value.renderGPX(gpx.value) }
)
watch(
  () => [filterStore.showPointsLayer, filterStore.showAreasLayer, filterStore.showGpxLayer],
  ([p, a, g]) => { if (map?.isStyleLoaded()) layers.value.applyLayerVisibility(p, a, g) }
)
watch(() => [props.isSidebarOpen, props.isMobile], () => {
  setTimeout(() => map?.resize(), 200)
})
watch(is3D, (val) => {
  if (val) {
    map.dragRotate.enable()
    map.touchZoomRotate.enableRotation()
  } else {
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
  }
})
</script>

<style>
.map {
  position: absolute;
  top: 0; bottom: 0;
  left: 250px; right: 0;
}

.basemap-control {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: 4px !important;
}

.maplibregl-ctrl-bottom-right {
  z-index: 1500;
}

.basemap-btn {
  width: 100%;
  padding: 6px 12px;
  background: white;
  border: none;
  border-bottom: 1px solid #ddd;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  color: #333;
  transition: background 0.15s;
  text-align: center;
  &:last-child { border-bottom: none; }
  &:hover { background: #f0f0f0; }
  &.active { background: #e8f5e3; color: #2D5A27; font-weight: 600; }
}

.basemap-sep {
  height: 1px;
  background: #ddd;
}

@media (max-width: 768px) {
  .map { left: 0; }
}
</style>