(function(){
/* Page 6: About — data sources, how to use, disclaimer */
const { useState } = React;
const T = window.Towns, Demo = window.Demo;
const UI = window.AqiUI;
const { SpeakBtn } = UI;
const DISCLAIMER = 'Disclaimer: follow app recommendations at your own risk. Forecast models, not medical advice.';
function About() {
  const [demo, setDemo] = useState(localStorage.getItem('aqidemo') || 'live');
  return (
    <section>
      <h2>About Tri-Cities AQI Guardian</h2>
      {demo !== 'live' && <span className="badge" style={{ background: '#facc15', marginLeft: 8 }}>DEMO DATA</span>}
      <div className="card">
        <p>Tri-Cities AQI Guardian is a free, privacy-friendly air-quality assistant for the Tri-Cities, WA area and all towns within a 60-mile radius.</p>
        <p><b>What the 7 pages do:</b></p>
        <ul style={{ margin: '6px 0 6px 20px', lineHeight: 1.6 }}>
          <li><b>1. Live forecast</b> — current US AQI for every town nearby, plus a 12-hour sparkline, and a box to set your house location.</li>
          <li><b>2. Topo map</b> — topographical (OpenTopoMap) view with AQI-colored and AQI-sized town markers and the 60-mile radius.</li>
          <li><b>3. Health advisor</b> — the exact decision tree: 80–101 worsening → library/recirculation; 101–150 → lung/heart question → sealed recirculation or community center/library; 150–170 + condition → library now/nearest clean town; over 170 → everyone moves.</li>
          <li><b>4. Drive</b> — nearest town with AQI under 101, fastest route + ETA (OSRM), Google Maps deep link, arrival-time AQI re-check with auto-reroute, and a shelter-in-place fallback.</li>
          <li><b>5. My house</b> — dedicated page to set your house by address search, GPS, or tapping the map.</li>
          <li><b>6. About</b> — this page.</li>
          <li><b>7. Demo</b> — simulated smoke scenarios so every advisory branch can be demonstrated without waiting for real smoke.</li>
        </ul>
      </div>
      <div className="card">
        <b>Data sources:</b> Open-Meteo Air Quality API (current + 48-h forecast, no key), OpenStreetMap Nominatim + Open-Meteo geocoding (address search), OpenStreetMap / OpenTopoMap (tiles), OSRM public router + Google Maps (routing/directions). Town list is hardcoded and Haversine-filtered to 60 miles from Tri-Cities, WA.
      </div>
      <div className="card" style={{ background: '#3a2a08', borderColor: '#a97b1f', color: '#ffe9b0' }}>
        <b>⚠ Disclaimer:</b> {DISCLAIMER} This is a forecast tool, not a medical device. Always follow local authorities and your medical provider during smoke or dust events.
      </div>
      <div className="row wrap">
        <a href="index.html"><button className="btn">Go to live forecast</button></a>
        <a href="scenarios.html"><button className="btn primary">Open demo scenarios</button></a>
      </div>
    </section>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<About />);

})();