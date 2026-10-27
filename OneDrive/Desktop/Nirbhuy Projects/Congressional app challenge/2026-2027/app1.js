(function(){
/* AQI Guardian UI part 1: helpers + map */
const { useState, useEffect, useMemo, useRef } = React;
const T = window.Towns, API = window.AqiApi;
const TOWNS0 = T.townsWithin60();
const DISCLAIMER = 'Disclaimer: follow app recommendations at your own risk. Forecast models, not medical advice.';

function useLeaflet() {
  const [ready, setReady] = useState(!!window.L);
  useEffect(() => {
    if (window.L) { setReady(true); return; }
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(l);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => setReady(true);
    s.onerror = () => setReady('error');
    document.head.appendChild(s);
    const timer = setTimeout(() => { if (!window.L) setReady('error'); }, 15000);
    return () => { clearTimeout(timer); s.onload = null; s.onerror = null; };
  }, []);
  return ready;
}
function speak(text) {
  try {
    if (!('speechSynthesis' in window)) { alert('Speak-aloud is not supported in this browser. Try Chrome or Edge.'); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch (e) { alert('Speak-aloud failed: ' + e.message); }
}
function stopSpeak() {
  try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
}
function SpeakBtn({ getText, label }) {
  const [on, setOn] = useState(false);
  useEffect(() => () => stopSpeak(), []);
  return (
    <span className="row">
      <button className="btn" onClick={() => { const t = getText(); if (!t) return; setOn(true); speak(t); }} title="Read this screen aloud">🔊 {label || 'Speak aloud'}</button>
      {on && <button className="btn" onClick={() => { stopSpeak(); setOn(false); }} title="Stop speaking">⏹ Stop</button>}
    </span>
  );
}
function Badge({ v }) {
  return <span className="badge" style={{ background: T.aqiColor(v), color: v == null || v > 300 ? '#fff' : '#101827' }}>{v == null ? 'Unavailable' : v} / {T.aqiLabel(v)}</span>;
}
function Spark({ hourly }) {
  if (!hourly) return null;
  const vals = hourly.slice(0, 24).filter((v) => v != null);
  if (!vals.length) return null;
  const max = Math.max.apply(null, vals.concat([1]));
  return <div className="spark">{vals.map((v, i) => <span key={i} style={{ height: Math.max(3, (v / max) * 26) + 'px', background: T.aqiColor(v) }} />)}</div>;
}
function MapView({ towns, house, route, topo, height, onPick }) {
  const ref = useRef(null), mapRef = useRef(null);
  const pickRef = useRef(null);
  pickRef.current = onPick;
  const leaf = useLeaflet();
  useEffect(() => {
    if (leaf !== true || !ref.current || mapRef.current) return;
    const map = L.map(ref.current).setView([T.CENTER.lat, T.CENTER.lon], 9);
    map.on('click', (e) => { if (pickRef.current) pickRef.current(e.latlng.lat, e.latlng.lng); });
    mapRef.current = map;
  }, [leaf]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.eachLayer((l) => map.removeLayer(l));
    const tiles = topo
      ? L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 15, attribution: 'OpenTopoMap/OSM' })
      : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: 'OpenStreetMap' });
    tiles.addTo(map);
    L.circle([T.CENTER.lat, T.CENTER.lon], { radius: 60 * 1609.34, color: '#0284c7', weight: 1.5, dashArray: '6 6', fillOpacity: 0.03 }).addTo(map);
    towns.forEach((t) => {
      L.circleMarker([t.lat, t.lon], { radius: 6 + Math.min(10, (t.now || 0) / 20),
        color: T.aqiColor(t.now), fillColor: T.aqiColor(t.now), fillOpacity: 0.75, weight: 2 })
        .bindPopup('<b>' + t.name + '</b><br>AQI: ' + (t.now ?? '--') + ' (' + T.aqiLabel(t.now) + ')<br>' + t.dist.toFixed(0) + ' mi').addTo(map);
    });
    if (house) L.marker([house.lat, house.lon]).bindPopup('<b>Selected location</b><br>AQI: ' + (house.aqi ?? '--')).addTo(map);
    if (route && route.line) { L.polyline(route.line, { color: '#0284c7', weight: 4 }).addTo(map); map.fitBounds(route.line); }
    else map.setView(house ? [house.lat, house.lon] : [T.CENTER.lat, T.CENTER.lon], house ? 10 : 9);
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [leaf, towns, house, route, topo]);
  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } }, []);
  return <div><div ref={ref} className="map" aria-label="Regional air-quality map" style={{ height: (height || 320) + 'px', display: leaf === true ? 'block' : 'none' }} />
    {leaf !== true && <p className="status-message" role="status">{leaf === 'error' ? 'The map could not load. You can still choose a town or address and use the forecast cards. Reload the page to retry the map.' : 'Loading regional map...'}</p>}</div>;
}
/* Shared UI helpers exposed for multi-page use (no ES modules allowed on file://). */
window.AqiUI = { SpeakBtn, Badge, Spark, MapView, useLeaflet, speak, stopSpeak };


})();