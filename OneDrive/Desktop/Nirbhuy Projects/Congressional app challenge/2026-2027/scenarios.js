(function(){
/* Page 7: Demo / test smoke scenarios */
const { useState } = React;
const T = window.Towns, Demo = window.Demo;
const UI = window.AqiUI;
const { SpeakBtn } = UI;
const DISCLAIMER = 'Disclaimer: follow app recommendations at your own risk. Forecast models, not medical advice.';
function Scenarios() {
  const [demo, setDemo] = useState(localStorage.getItem('aqidemo') || 'live');
  const active = Demo.SCEN.find((s) => s.id === demo) || Demo.SCEN[0];
  const apply = (id) => { localStorage.setItem('aqidemo', id); setDemo(id); };
  return (
    <section>
      <div className="row space">
        <h2>Demo scenarios</h2>
        <SpeakBtn label="Speak" getText={() => 'Choose a simulated smoke scenario to test every advisory branch. Current: ' + active.label + '.'} />
      </div>
      <div className="card">
        <p>Pick a scenario, then visit any other page to see it in action. The choice is saved and applied across all pages.</p>
        <label className="lbl">Active scenario: <b>{active.label}</b> — {active.desc}</label>
      </div>
      <div className="grid">
        {Demo.SCEN.map((s) => (
          <div className="card town" key={s.id}>
            <div className="row space"><b>{s.label}</b><span className={s.id === demo ? 'badge' : ''} style={s.id === demo ? { background: '#facc15' } : {}}>{s.id === demo ? 'ACTIVE' : ''}</span></div>
            <div className="muted small">{s.desc}</div>
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button className={s.id === demo ? 'btn primary' : 'btn'} onClick={() => apply(s.id)}>{s.id === demo ? 'Applied' : 'Apply'}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="muted small">Scenarios override live AQI on every page. Select "Live air (real data)" to return to real Open-Meteo readings.</div>
      <div className="row wrap" style={{ marginTop: 10 }}>
        <a href="index.html"><button className="btn">Go to live forecast</button></a>
      </div>
    </section>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Scenarios />);

})();