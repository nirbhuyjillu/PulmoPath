(function(){
/* Page 3: Health advisor — decision tree from prompt.md */
const { useState } = React;
const T = window.Towns, API = window.AqiApi, Demo = window.Demo;
const UI = window.AqiUI;
const { SpeakBtn, Badge } = UI;
const DISCLAIMER = 'Disclaimer: follow app recommendations at your own risk. Forecast models, not medical advice.';
const TOWNS0 = T.townsWithin60();
function loadHouse() { try { return JSON.parse(localStorage.getItem('aqi-house') || 'null'); } catch { return null; } }
function Advisor() {
  const [demo, setDemo] = useState(localStorage.getItem('aqidemo') || 'live');
  const [cond, setCond] = useState(null);
  const [house, setHouse] = useState(loadHouse);
  const [towns, setTowns] = useState(TOWNS0.map((t) => ({ ...t })));
  const effHouse = Demo.applyToHouse(house, demo) || house;
  const effTowns = Demo.applyToTowns(towns, demo) || towns;
  const src = (effHouse && effHouse.aqi != null)
    ? { label: effHouse.label, aqiNow: effHouse.aqi, hourly: effHouse.hourly, dustNow: effHouse.dustNow, dustHourly: effHouse.dustHourly }
    : (() => { const w = [...effTowns].sort((a, b) => (b.now ?? -1) - (a.now ?? -1))[0]; return w ? { label: w.name + ' (worst nearby)', aqiNow: w.now, hourly: w.hourly, dustNow: w.dustNow, dustHourly: w.dustHourly } : { label: '--', aqiNow: null }; })();
  const adv = window.Advisory.buildAdvice({ ...src, hasCondition: cond });
  return (
    <section>
      <div className="row space">
        <h2>Health advisor</h2>
        <SpeakBtn label="Speak advice" getText={() => 'Health advice for ' + src.label + '. Air quality index ' + (src.aqiNow ?? 'unknown') + '. ' + adv.steps.join(' ')} />
      </div>
      {demo !== 'live' && <span className="badge" style={{ background: '#facc15', marginLeft: 8 }}>DEMO DATA</span>}
      <div className="card">
        <div className="row space"><b>Location: {src.label}</b><Badge v={src.aqiNow} /></div>
        <div className="muted small">12h peak: {adv.soon ?? '--'} · Dust storm: {adv.dustStorm ? 'YES' : 'no'} · Going outside blocked: {adv.blocked ? 'YES' : 'no'}</div>
        {!effHouse && <div className="muted small">Tip: set your house on the Live forecast or My house page for a personal assessment.</div>}
      </div>
      {adv.ask && (
        <div className="card">
          <b>Do you have a lung or heart condition?</b>
          <div className="row">
            <button className="btn primary" onClick={() => setCond(true)}>Yes</button>
            <button className="btn" onClick={() => setCond(false)}>No</button>
          </div>
        </div>
      )}
      {cond !== null && <div className="card small">Condition on file: <b>{cond ? 'Yes' : 'No'}</b> <button className="link" onClick={() => setCond(null)}>change</button></div>}
      <div className="card advice">
        {adv.steps.map((s, i) => <p key={i}>{s}</p>)}
        {adv.goto4 && <a href="drive.html"><button className="btn primary">Go to Drive: Find clean air</button></a>}
      </div>
      <div className="card small muted">
        Protocol: 80-101 worsening - library/recirculation · 101-150 + condition - sealed recirculation or community center/library · 150-170 + condition - library now / nearest clean town · over 170 - all move · Never go out during dust storm or AQI over 125.
      </div>
    </section>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Advisor />);

})();