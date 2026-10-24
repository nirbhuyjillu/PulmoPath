(function(){
/* Page 1: Live forecast — real-time AQI across the 60-mile region + your house */
const { useState, useEffect, useMemo } = React;
const T = window.Towns, API = window.AqiApi, Demo = window.Demo;
const UI = window.AqiUI;
const { SpeakBtn, Badge, Spark, MapView } = UI;
const DISCLAIMER = 'Disclaimer: follow app recommendations at your own risk. Forecast models, not medical advice.';
const TOWNS0 = T.townsWithin60();
function loadHouse() { try { return JSON.parse(localStorage.getItem('aqi-house') || 'null'); } catch { return null; } }
function saveHouse(h) { try { localStorage.setItem('aqi-house', JSON.stringify(h)); } catch {} }

function Home() {
  const [demo, setDemo] = useState(localStorage.getItem('aqidemo') || 'live');
  const [towns, setTowns] = useState(TOWNS0.map((t) => ({ ...t })));
  const [house, setHouse] = useState(loadHouse);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const effHouse = Demo.applyToHouse(house, demo) || house;
  const effTowns = Demo.applyToTowns(towns, demo) || towns;
  const refresh = async () => {
    setLoading(true); setErr('');
    try { setTowns(await API.fetchTownAQIs(TOWNS0)); }
    catch (ex) { setErr(ex.message); }
    setLoading(false);
  };
  useEffect(() => { refresh(); const id = setInterval(refresh, 10 * 60 * 1000); return () => clearInterval(id); }, []);
  const sorted = useMemo(() => [...effTowns].sort((a, b) => (a.now ?? 9999) - (b.now ?? 9999)), [effTowns]);
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
        <h2>Live forecast · 60-mile radius</h2>
        <span className="row">
          <SpeakBtn label="Speak aloud" getText={() => {
            const top = [...effTowns].sort((a, b) => (b.now ?? -1) - (a.now ?? -1)).slice(0, 5);
            const worst = top.map((t) => t.name + ' A Q I ' + (t.now ?? 'unknown')).join(', ');
            const h = effHouse ? 'Your house at ' + effHouse.label + ' has A Q I ' + (effHouse.aqi ?? 'unknown') + ', ' + T.aqiLabel(effHouse.aqi) + '. ' : 'No house set yet. ';
            return 'Tri-Cities air quality forecast. ' + h + 'Worst areas nearby: ' + worst + '.';
          }} />
          <button className="btn" onClick={refresh} disabled={loading}>{loading ? 'Updating...' : 'Refresh'}</button>
        </span>
      </div>
      {demo !== 'live' && <span className="badge" style={{ background: '#facc15', marginLeft: 8 }}>DEMO DATA</span>}
      {err && <p className="err">Note: {err} (retrying with cached data)</p>}
      <form className="card" onSubmit={search}>
        <label className="lbl">Your house location</label>
        <div className="muted small">Type any format with street, city & state — e.g. "1234 George Washington Way, Richland, WA". Then pick your match below.</div>
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
          <div className="muted small">No match for that exact text. Check spelling, add ZIP ("... WA 99352"), or tap the map to drop a pin.</div>
        )}
        {house && (
          <div className="house">
            <button className="link" onClick={() => { saveHouse(null); setHouse(null); }} style={{ float: 'right' }}>Clear</button>
            <b>{house.label}</b> <Badge v={house.aqi} />
            <div className="muted small">12h peak: {API.maxSoon(house.hourly) ?? '--'} · Updated {house.time || '--'}</div>
          </div>
        )}
        <div className="muted small">Tip: set your house here or on the My house page for a personal health assessment.</div>
        <div className="muted small">Can't find it? Tap anywhere on the map below to drop a pin at your house.</div>
        <MapView towns={effTowns} house={effHouse} onPick={dropPin} height={320} />
        <div className="grid">
          {sorted.map((t) => (
            <div className="card town" key={t.name}>
              <div className="row space"><b>{t.name}</b><span className="muted small">{t.dist.toFixed(0)} mi</span></div>
              <Badge v={t.now} />
              <Spark hourly={t.hourly} />
              <div className="muted small">12h peak {API.maxSoon(t.hourly) ?? '--'} · PM2.5 {t.pm25 ?? '--'}</div>
            </div>
          ))}
        </div>
      </form>
      </section>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Home />);


})();