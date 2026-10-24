(function(){
/* Page 5: My house — set your house location (address search, GPS, or map pin) */
const { useState, useEffect, useMemo } = React;
const T = window.Towns, API = window.AqiApi, Demo = window.Demo;
const UI = window.AqiUI;
const { SpeakBtn, Badge, Spark, MapView } = UI;
const DISCLAIMER = 'Disclaimer: follow app recommendations at your own risk. Forecast models, not medical advice.';
const TOWNS0 = T.townsWithin60();
function loadHouse() { try { return JSON.parse(localStorage.getItem('aqi-house') || 'null'); } catch { return null; } }
function saveHouse(h) { try { localStorage.setItem('aqi-house', JSON.stringify(h)); } catch {} }
function HousePage() {
  const [demo, setDemo] = useState(localStorage.getItem('aqidemo') || 'live');
  const [towns, setTowns] = useState(TOWNS0.map((t) => ({ ...t })));
  const [house, setHouse] = useState(loadHouse);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const effHouse = Demo.applyToHouse(house, demo) || house;
  const effTowns = Demo.applyToTowns(towns, demo) || towns;
  const refresh = async () => {
    try { setTowns(await API.fetchTownAQIs(TOWNS0)); } catch (ex) {}
  };
  useEffect(() => { refresh(); }, []);
  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setSearched(false);
    try { setResults(await API.geocodePlace(q.trim())); setSearched(true); }
    catch (ex) { alert('Search failed: ' + ex.message); }
    setBusy(false);
  };
  const pick = async (r) => {
    setBusy(true);
    try {
      const d = await API.fetchPointAQI(r.lat, r.lon);
      const h = { ...r, aqi: d.now, hourly: d.hourly, dustNow: d.dustNow, dustHourly: d.dustHourly, time: d.time };
      saveHouse(h); setHouse(h); setResults([]);
    } catch (ex) { alert('AQI lookup failed: ' + ex.message); }
    setBusy(false);
  };
  const locate = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async (p) => {
      try {
        const d = await API.fetchPointAQI(p.coords.latitude, p.coords.longitude);
        const h = { label: 'My current location', lat: p.coords.latitude, lon: p.coords.longitude, aqi: d.now, hourly: d.hourly, dustNow: d.dustNow, dustHourly: d.dustHourly, time: d.time };
        saveHouse(h); setHouse(h);
      } catch (ex) { alert('AQI lookup failed: ' + ex.message); }
      setBusy(false);
    }, () => { alert('Location permission denied.'); setBusy(false); });
  };
  const dropPin = async (lat, lon) => {
    setBusy(true);
    try {
      const d = await API.fetchPointAQI(lat, lon);
      const h = { label: 'Pinned location (' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ')', lat, lon, aqi: d.now, hourly: d.hourly, dustNow: d.dustNow, dustHourly: d.dustHourly, time: d.time };
      saveHouse(h); setHouse(h); setResults([]);
    } catch (ex) { alert('AQI lookup failed: ' + ex.message); }
    setBusy(false);
  };
  return (
    <section>
      <div className="row space">
        <h2>My house</h2>
        <SpeakBtn label="Speak" getText={() => 'Set your house location for a personal air quality reading. ' + (effHouse ? 'Your house is ' + effHouse.label + ' with A Q I ' + (effHouse.aqi ?? 'unknown') + '.' : 'No house set yet.')} />
      </div>
      {demo !== 'live' && <span className="badge" style={{ background: '#facc15', marginLeft: 8 }}>DEMO DATA</span>}
      <div className="card">
        {effHouse ? (
          <>
            <div className="row space"><b>Your house:</b> {effHouse.label}</div>
            <div className="row space"><b>AQI:</b> <Badge v={effHouse.aqi} /> <b>12h peak:</b> {API.maxSoon(effHouse.hourly) ?? '--'} <b>Updated:</b> {effHouse.time || '--'}</div>
            <button className="link" onClick={() => { saveHouse(null); setHouse(null); }}>Clear house location</button>
          </>
        ) : (
          <div className="muted small">No house set. Use the form, GPS button, or tap the map below.</div>
        )}
      </div>
      <form className="card" onSubmit={search}>
        <label className="lbl">Address search</label>
        <div className="muted small">Type any format with street, city & state — e.g. "1234 George Washington Way, Richland, WA" or just "Richland, WA".</div>
        <div className="row">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Street, City, State" />
          <button className="btn primary" disabled={busy}>{busy ? 'Searching...' : 'Search'}</button>
        </div>
        {results.length && (
          <ul className="results">
            {results.map((r, i) => (
              <li key={i} className="card town row wrap" style={{ padding: 8 }}>
                <div style={{ flex: 1 }}><b>{r.label}</b></div>
                <button className="btn primary" onClick={() => pick(r)} style={{ marginLeft: 6 }}>Use this</button>
              </li>
            ))}
          </ul>
        )}
        {searched && !results.length && !busy && (
          <div className="muted small">No match. Add a ZIP ("... WA 99352") or drop a pin on the map.</div>
        )}
        <div className="row wrap" style={{ marginTop: 6 }}>
          <button className="btn" onClick={locate} disabled={busy}>{busy ? 'Locating...' : '📍 Use my GPS location'}</button>
        </div>
      </form>
      <div className="muted small">Can't find it? Tap anywhere on the map below to drop a pin at your house.</div>
      <MapView towns={effTowns} house={effHouse} onPick={dropPin} height={340} />
    </section>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<HousePage />);

})();