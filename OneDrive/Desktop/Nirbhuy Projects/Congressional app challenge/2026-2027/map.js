(function(){
/* Page 2: Topographical AQI map */
const { useState } = React;
const T = window.Towns, Demo = window.Demo;
const UI = window.AqiUI;
const { SpeakBtn, MapView } = UI;
const DISCLAIMER = 'Disclaimer: follow app recommendations at your own risk. Forecast models, not medical advice.';
const TOWNS0 = T.townsWithin60();
function MapPage() {
  const [demo, setDemo] = useState(localStorage.getItem('aqidemo') || 'live');
  const [towns, setTowns] = useState(TOWNS0.map((t) => ({ ...t })));
  const [topo, setTopo] = useState(true);
  const effTowns = Demo.applyToTowns(towns, demo) || towns;
  const worst = [...effTowns].sort((a, b) => (b.now ?? -1) - (a.now ?? -1))[0];
  return (
    <section>
      <div className="row space">
        <h2>Topographical AQI map</h2>
        <span className="row">
          <SpeakBtn label="Speak map" getText={() => 'Topographical air quality map. ' + effTowns.length + ' towns shown. Worst right now: ' + (worst ? worst.name + ' A Q I ' + worst.now : 'unknown') + '.'} />
          <label className="small"><input type="checkbox" checked={topo} onChange={(e) => setTopo(e.target.checked)} /> topo layer</label>
        </span>
      </div>
      {demo !== 'live' && <span className="badge" style={{ background: '#facc15', marginLeft: 8 }}>DEMO DATA</span>}
      <div className="card">
        <MapView towns={effTowns} house={null} topo={topo} height={440} />
        <div className="legend">
          {[30, 80, 120, 175, 250].map((v) => <span key={v}><i style={{ background: T.aqiColor(v) }} />{v} {T.aqiLabel(v)}</span>)}
        </div>
      </div>
      <p className="muted small">Markers are sized and colored by current US AQI. The blue dashed circle is the 60-mile radius around Tri-Cities, WA. Tap a marker to see a town's AQI.</p>
    </section>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<MapPage />);

})();