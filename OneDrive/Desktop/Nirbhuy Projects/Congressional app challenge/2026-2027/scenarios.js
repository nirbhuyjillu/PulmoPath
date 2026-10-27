(function(){
/* Page 7: Demo / test smoke scenarios */
const { useState, useEffect } = React;
const T = window.Towns, Demo = window.Demo;
const UI = window.AqiUI;
const { SpeakBtn } = UI;
const DISCLAIMER = 'Disclaimer: follow app recommendations at your own risk. Forecast models, not medical advice.';
function Scenarios() {
  const [demo, setDemo] = useState(Demo.getMode);
  const active = Demo.SCEN.find((s) => s.id === demo) || Demo.SCEN[0];
  const apply = (id) => Demo.setMode(id);
  useEffect(() => {
    const update = () => setDemo(Demo.getMode());
    window.addEventListener('aqi:modechange', update);
    return () => window.removeEventListener('aqi:modechange', update);
  }, []);
  return (
    <section>
      <h1>Explore a smoke scenario.</h1>
      <p className="page-intro">Try the full experience without waiting for a smoke event. Your choice updates forecasts, health guidance, and the route model throughout the app. Your saved location is not replaced.</p>
      <div className="card" role="status" aria-live="polite">
        <h2>{demo === 'live' ? 'Live forecast selected' : 'Demo active: ' + active.label}</h2><p>{active.desc}</p>
        <div className="actions"><a className="btn primary" href="index.html">See this forecast</a><a className="btn" href="advisor.html">See health guidance</a><a className="btn" href="regression.html">Explore route model</a></div>
      </div>
      <div className="card-grid">
        {Demo.SCEN.map((s) => (
          <div className={'card' + (s.id === demo ? ' selected' : '')} key={s.id}>
            <h2>{s.label}</h2>
            {s.now != null && <p className="small muted">Central Tri-Cities: AQI {s.now} now / {s.peak} peak. Wind {s.wind} km/h.</p>}
            {s.currentPEF != null && <p className="small muted">Route demo: sample PEF {s.currentPEF} L/min, personal best {s.personalBest} L/min. Fictional inputs, not predicted health measurements.</p>}
            <p className="muted">{s.desc}</p>
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button type="button" className={s.id === demo ? 'btn primary' : 'btn'} aria-pressed={s.id === demo} onClick={() => apply(s.id)}>{s.id === demo ? 'Selected' : s.id === 'live' ? 'Use live data' : 'Try this scenario'}</button>
            </div>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 20 }}>Demo air quality, wind, and sample PEF inputs are illustrative, not predictions. The route advisor automatically compares destinations using the selected scenario. Map tiles, address searches, and driving directions still need an internet connection. Use Return to live data at the top of any page to leave demo mode.</p>
    </section>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Scenarios />);

})();