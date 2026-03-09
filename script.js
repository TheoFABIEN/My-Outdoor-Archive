var map = L.map('map').setView([45.9, 6.1], 9);

var hikesLayer = L.layerGroup().addTo(map);
var climbingLayer = L.layerGroup().addTo(map);

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
).addTo(map);


const orangeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});



function loadHikes() {

  const difficulty = document.getElementById("difficulty").value;
  const gaz = document.getElementById("gaz").value;

  let url = "http://localhost:8000/hikes?";

  if (difficulty) url += `difficulty=${difficulty}&`;
  if (gaz) url += `gaz=${gaz}&`;

  fetch(url)
  .then(res => res.json())
  .then(data => {

    hikesLayer.clearLayers();

    data.forEach(hike => {

      L.marker([hike.lat, hike.lon])
      .addTo(hikesLayer)
      .bindPopup(`<b>${hike.name}</b><br>${hike.notes}`);

    });

  });
}


function loadClimbingSpots() {

  fetch("http://localhost:8000/climbing_spots")
  .then(res => res.json())
  .then(data => {

    climbingLayer.clearLayers();

    data.forEach(spot => {

      const geom = JSON.parse(spot.geom);

      const layer = L.geoJSON(geom, {color: "orange"})
      .addTo(climbingLayer);

      const center = layer.getBounds().getCenter();

      L.marker(center, {icon: orangeIcon})
      .addTo(climbingLayer)
      .bindPopup(`<b>${spot.name}</b><br>${spot.notes}`);

    });

  });

}




document.getElementById("applyFilters")
.addEventListener("click", loadHikes);

document.getElementById("toggleHikes")
.addEventListener("change", function() {
  this.checked ? map.addLayer(hikesLayer) : map.removeLayer(hikesLayer);
});

document.getElementById("toggleClimbing")
.addEventListener("change", function() {
  this.checked ? map.addLayer(climbingLayer) : map.removeLayer(climbingLayer);
});



// Click mode for adding elements
let addingMode = false;
document.getElementById("startAdd").addEventListener("click", () => {
  console.log("CLICK ADD BUTTON");
  addingMode = true;
  alert("Clique sur la carte pour ajouter un élément");
});

// Detect click on the map for getting coordinates
map.on("click", function(e) {

  if (!addingMode) return;

  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  const name = prompt("Nom ?");
  const notes = prompt("Notes ?");
  const type = document.getElementById("newType").value;

  const data = {
    name: name,
    notes: notes,
    lat: lat,
    lon: lon
  };

  if (type === "hike") {
    fetch("http://localhost:8000/add_hike", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data)
    })
    .then(() => loadHikes());
  }

  if (type === "climbing") {
    fetch("http://localhost:8000/add_climbing_spot", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(data)
    })
    .then(() => loadClimbingSpots());
  }

  addingMode = false;

});


loadHikes();
loadClimbingSpots();

// Enabling drawing for adding climbing spots
//
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    polyline: false,
    rectangle: false,
    circle: false,
    marker: false
  },
  edit: {
    featureGroup: drawnItems
  }
});

map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, function (event) {

  var layer = event.layer;
  drawnItems.addLayer(layer);
  const geojson = layer.toGeoJSON();
  const name = prompt("Nom du spot ?");
  const notes = prompt("Notes ?");

  fetch("http://localhost:8000/add_climbing_spot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: name,
      notes: notes,
      geometry: geojson.geometry
    })
  })
  .then(res => res.json())
  .then(() => {
      alert("Spot ajouté !");
      loadClimbingSpots();
  });

});
