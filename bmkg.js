// Variabel global
var map;
var LayerGempaTerbaru; // Layer group untuk gempa terbaru (autogempa)
var LayerGempaDirasakan;   // Layer group untuk gempa dirasakan

// URL API BMKG (menggunakan proxy CORS jika diperlukan)
const autogempaUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json');
const feltEarthquakeDataUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json');

var openStreetMapTile; // Variabel untuk tile layer

const loadingIndicator = document.getElementById('loading-indicator');
const latestEqStatusEl = document.getElementById('latest-earthquake-status');
const feltEqStatusEl = document.getElementById('felt-earthquake-status');
const lastUpdatedLatestEl = document.getElementById('last-updated-latest');

function showLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'block';
}

function hideLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}

function updateStatus(element, message, success = true) {
    if (element) {
        element.textContent = message;
        element.style.color = success? 'green' : 'red';
    }
}

function getCurrentTimestamp() {
    return new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'long' });
}

// Fungsi Inisialisasi Peta
function initMap() {
    showLoading();
    map = L.map('map').setView([-2.548926, 118.0148634], 5); // Tengah Indonesia

    openStreetMapTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    LayerGempaTerbaru = L.layerGroup().addTo(map);
    LayerGempaDirasakan = L.layerGroup();

    var overlayMaps = {
        "Gempa Terbaru (Radius Dampak)": LayerGempaTerbaru,
        "Gempa Dirasakan (Radius Dampak)": LayerGempaDirasakan
    };
    L.control.layers(null, overlayMaps, { collapsed: false, position: 'topright' }).addTo(map);

    addLegend();

    // Panggil fungsi fetch data dan kumpulkan promises-nya
    const initialLatestFetch = fetchAndUpdateLatestEarthquakeData();
    const initialFeltFetch = fetchFeltEarthquakeData();

    // Tunggu kedua fetch awal selesai sebelum menyembunyikan loading
    Promise.all([initialLatestFetch, initialFeltFetch]).finally(() => {
        hideLoading();
    });

    setInterval(fetchAndUpdateLatestEarthquakeData, 300000); // Refresh data gempa terbaru setiap 5 menit
    setInterval(fetchFeltEarthquakeData, 600000); // Refresh data gempa dirasakan setiap 10 menit
}

// Fungsi untuk mengambil dan memperbarui data gempa terbaru (autogempa)
async function fetchAndUpdateLatestEarthquakeData() {
    updateStatus(latestEqStatusEl, "Memperbarui...", true);
    console.log("Mencoba mengambil data gempa terbaru (autogempa)...");
    try {
        const response = await fetch(autogempaUrl);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        const data = await response.json();
        if (data && data.Infogempa && data.Infogempa.gempa) {
            updateLatestEarthquakeLayer(data.Infogempa.gempa);
            updateStatus(latestEqStatusEl, "Berhasil dimuat", true);
            if (lastUpdatedLatestEl) lastUpdatedLatestEl.textContent = getCurrentTimestamp();
        } else {
            console.error("Format data autogempa BMKG tidak sesuai harapan:", data);
            updateStatus(latestEqStatusEl, "Format data salah", false);
        }
    } catch (error) {
        console.error("Gagal mengambil atau memproses data autogempa dari BMKG:", error);
        updateStatus(latestEqStatusEl, `Gagal: ${error.message}`, false);
    }
}

// Fungsi untuk mengambil data gempa dirasakan
async function fetchFeltEarthquakeData() {
    updateStatus(feltEqStatusEl, "Memperbarui...", true);
    console.log("Mencoba mengambil data gempa dirasakan...");
    try {
        const response = await fetch(feltEarthquakeDataUrl);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        const data = await response.json();
        if (data && data.Infogempa && data.Infogempa.gempa && Array.isArray(data.Infogempa.gempa)) {
            updateLayerGempaDirasakan(data.Infogempa.gempa);
            updateStatus(feltEqStatusEl, "Berhasil dimuat", true);
        } else {
            console.error("Format data gempadirasakan BMKG tidak sesuai harapan atau bukan array:", data);
            updateStatus(feltEqStatusEl, "Format data salah", false);
        }
    } catch (error) {
        console.error("Gagal mengambil atau memproses data gempadirasakan dari BMKG:", error);
        updateStatus(feltEqStatusEl, `Gagal: ${error.message}`, false);
    }
}

// Fungsi untuk mem-parse string koordinat "lat,lon"
function parseCoordinates(coordsString) {
    if (!coordsString || typeof coordsString!== 'string') {
        console.error("Input koordinat tidak valid atau bukan string:", coordsString);
        return null;
    }
    const parts = coordsString.split(',');
    if (parts.length!== 2) {
        console.error("Format string koordinat tidak sesuai (harus 'lat,lon'):", coordsString);
        return null;
    }
    const lat = parseFloat(parts); // Koreksi: parts untuk latitude
    const lon = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lon)) {
        console.error("Gagal mem-parse latitude atau longitude dari string:", coordsString);
        return null;
    }
    return {
        lat: lat,
        lon: lon
    };
}

// Fungsi perhitungan radius dampak (dalam km)
function calculateImpactRadius(magnitude, depthKm) {
    const M = parseFloat(magnitude);
    let D_str = String(depthKm).replace(/\s*km/i, '');
    const D = parseFloat(D_str);

    if (isNaN(M) || isNaN(D) || D <= 0) {
        console.warn("Input magnitudo atau kedalaman tidak valid untuk kalkulasi radius:", magnitude, depthKm);
        return 0;
    }
    // Rumus: radius_felt = 10^(0.45*M - 1.88) * sqrt(D) [2]
    const radiusKm = Math.pow(10, (0.45 * M - 1.88)) * Math.sqrt(D);
    return radiusKm;
}

// Fungsi untuk memperbarui lapisan gempa terbaru (autogempa)
function updateLatestEarthquakeLayer(eqData) {
    LayerGempaTerbaru.clearLayers();

    const coords = parseCoordinates(eqData.Coordinates);
    if (!coords) {
        console.error("Koordinat autogempa tidak dapat diproses:", eqData.Coordinates);
        return;
    }

    const magnitude = parseFloat(eqData.Magnitude);
    const depth = eqData.Kedalaman;
    const radiusKm = calculateImpactRadius(magnitude, depth); // [2]
    const radiusMeters = radiusKm * 1000;

    const marker = L.marker([coords.lat, coords.lon]);
    marker.bindPopup(
        `<b>Gempa Terbaru</b><br>` +
        `<b>${eqData.Wilayah}</b><br>` +
        `Tanggal: ${eqData.Tanggal}, Jam: ${eqData.Jam}<br>` +
        `Magnitudo: ${eqData.Magnitude} SR<br>` +
        `Kedalaman: ${eqData.Kedalaman}<br>` +
        `Perkiraan Radius Dampak: ${radiusKm.toFixed(2)} km`
    ).addTo(LayerGempaTerbaru);
// Update info banner di atas peta
const banner = document.getElementById('banner-content');
if (banner) {
    banner.textContent = `${eqData.Wilayah} | ${eqData.Magnitude} SR | ${eqData.Tanggal} ${eqData.Jam}`;
}

    if (radiusMeters > 0) {
        L.circle([coords.lat, coords.lon], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.3,
            radius: radiusMeters
        }).addTo(LayerGempaTerbaru);
    }

    if (map.hasLayer(LayerGempaTerbaru) && LayerGempaTerbaru.getLayers().length > 0) {
        marker.openPopup();
    }
    map.setView([coords.lat, coords.lon], 7); // Zoom lebih dekat ke gempa terbaru
}

// Fungsi untuk memperbarui lapisan gempa dirasakan
function updateLayerGempaDirasakan(earthquakes) {
    LayerGempaDirasakan.clearLayers();

    earthquakes.forEach(eqData => {
        const coords = parseCoordinates(eqData.Coordinates);
        if (!coords) {
            console.error("Koordinat gempadirasakan tidak dapat diproses:", eqData.Coordinates);
            return;
        }

        const magnitude = parseFloat(eqData.Magnitude);
        const depth = eqData.Kedalaman;
        const radiusKm = calculateImpactRadius(magnitude, depth); // [2]
        const radiusMeters = radiusKm * 1000;

        const marker = L.marker([coords.lat, coords.lon], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        });
        marker.bindPopup(
            `<b>Gempa Dirasakan</b><br>` +
            `<b>${eqData.Wilayah}</b><br>` +
            `Tanggal: ${eqData.Tanggal}, Jam: ${eqData.Jam}<br>` +
            `Magnitudo: ${eqData.Magnitude} SR<br>` +
            `Kedalaman: ${eqData.Kedalaman}<br>` +
            `Dirasakan: ${eqData.Dirasakan || 'Informasi tidak tersedia'}<br>` +
            `Perkiraan Radius Dampak: ${radiusKm.toFixed(2)} km`
        ).addTo(LayerGempaDirasakan);

        if (radiusMeters > 0) {
            L.circle([coords.lat, coords.lon], {
                color: 'blue',
                fillColor: '#03f',
                fillOpacity: 0.3,
                radius: radiusMeters
            }).addTo(LayerGempaDirasakan);
        }
    });
}

// Fungsi untuk menambahkan legenda ke peta
function addLegend() {
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'leaflet-legend-box');
        div.innerHTML = `
            <h4>Legenda Peta</h4>
            <div class="legend-item">
                <img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png" width="12" height="20" /> 
                <span>Episentrum Gempa Terbaru</span>
            </div>
            <div class="legend-item">
                <i class="legend-circle" style="background: rgba(255, 0, 51, 0.5); border: 1px solid red;"></i> 
                <span>Radius Dampak (Gempa Terbaru)</span>
            </div>
            <div class="legend-item">
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png" width="12" height="20" /> 
                <span>Episentrum Gempa Dirasakan</span>
            </div>
            <div class="legend-item">
                <i class="legend-circle" style="background: rgba(0, 51, 255, 0.5); border: 1px solid blue;"></i> 
                <span>Radius Dampak (Gempa Dirasakan)</span>
            </div>
        `;
        return div;
    };

    legend.addTo(map);
}


// Event listener untuk memulai semua setelah DOM siap
document.addEventListener('DOMContentLoaded', initMap);