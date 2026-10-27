(function(){
/* Demo smoke scenarios: window.Demo — overrides live AQI for testing/judging. */
(function () {
  const SCEN = [
    { id: 'live', label: 'Live forecast', desc: 'Current modeled conditions from Open-Meteo, not a local sensor reading.' },
    { id: 'moderate', label: 'Smoke building', now: 90, peak: 115, dust: 0, wind: 12, personalBest: 400, currentPEF: 330, desc: 'Moderate now, becoming unhealthy for sensitive groups over the next six hours.' },
    { id: 'usg', label: 'Sensitive groups at risk', now: 120, peak: 130, dust: 0, wind: 16, personalBest: 400, currentPEF: 300, desc: 'See how guidance changes for people with heart or lung conditions.' },
    { id: 'usg-blocked', label: 'Smoke and blowing dust', now: 130, peak: 140, dust: 80, wind: 45, personalBest: 400, currentPEF: 285, dustEvent: true, desc: 'A simulated dust event: reduce exposure and check official road and weather alerts.' },
    { id: 'unhealthy', label: 'Unhealthy air', now: 160, peak: 185, dust: 0, wind: 10, personalBest: 400, currentPEF: 260, desc: 'Everyone should reduce prolonged or heavy outdoor activity.' },
    { id: 'hazard', label: 'Hazardous smoke', now: 320, peak: 350, dust: 0, wind: 8, personalBest: 400, currentPEF: 240, desc: 'A severe simulated event. Stay in cleaner indoor air and follow emergency guidance.' }
  ];
  function hourlySeries(now, peak) {
    // 48-hour ramp: now → peak over ~6h, then easing back toward now.
    const arr = [];
    for (let h = 0; h < 48; h++) {
      const rise = Math.min(h / 6, 1);
      const fall = h > 12 ? Math.min(1, (h - 12) / 24) : 0;
      arr.push(Math.round(now + (peak - now) * rise - (peak - now) * fall));
    }
    return arr;
  }
  function dustSeries(d) {
    const arr = [];
    for (let h = 0; h < 48; h++) arr.push(d);
    return arr;
  }
  function applyToTowns(towns, id) {
    const s = SCEN.find((x) => x.id === id);
    if (!s || id === 'live') return null; // null = use live data
    // Use the canonical regional order, not the caller's sorting or subset.
    // This is an illustrative gradient, not a smoke-dispersion model.
    const region = window.Towns.townsWithin60();
    return towns.map((t) => {
      const nearest = region.reduce((best, town, index) => {
        const distance = window.Towns.haversineMiles(t.lat, t.lon, town.lat, town.lon);
        return distance < best.distance ? { index, distance } : best;
      }, { index: 0, distance: Infinity });
      const i = nearest.index;
      const relief = Math.min(280, i * 14);
      const now = Math.max(28, s.now - relief);
      const peak = Math.max(30, s.peak - relief);
      return { ...t, now, pm25: pm25ForAQI(now), dustNow: s.dust, windSpeed: s.wind, dustEvent: !!s.dustEvent,
        dustHourly: dustSeries(s.dust), hourly: hourlySeries(now, peak),
        hourlyTimes: Array.from({ length: 48 }, (_, hour) => Math.floor(Date.now() / 3600000) * 3600000 + hour * 3600000),
        time: 'Simulated conditions', windTime: 'Simulated conditions', source: 'demo', scenarioId: id };
    });
  }
  function applyToHouse(house, id) {
    const s = SCEN.find((x) => x.id === id);
    if (!s || id === 'live') return house;
    const place = house || { ...window.Towns.CENTER, label: 'Richland demo location' };
    const reading = applyToTowns([place], id)[0];
    return { ...reading, aqi: reading.now };
  }
  // Illustrative PM2.5 from EPA breakpoints; simulated, not a pollutant measurement.
  function pm25ForAQI(aqi) {
    const bands = [[0,50,0,9], [51,100,9.1,35.4], [101,150,35.5,55.4], [151,200,55.5,125.4], [201,300,125.5,225.4], [301,500,225.5,325.4]];
    const [lo,hi,cLo,cHi] = bands.find(b => aqi <= b[1]) || bands[5];
    return Math.round((cLo + (aqi-lo)*(cHi-cLo)/(hi-lo))*10)/10;
  }
  let memory = 'live';
  function getMode() {
    try { memory = localStorage.getItem('aqidemo') || 'live'; } catch (_) {}
    return SCEN.some(s => s.id === memory) ? memory : 'live';
  }
  function setMode(id) {
    if (!SCEN.some(s => s.id === id)) return;
    memory = id;
    try { localStorage.setItem('aqidemo', id); } catch (_) {}
    window.dispatchEvent(new Event('aqi:modechange'));
  }
  window.addEventListener('storage', e => {
    if (e.key === 'aqidemo' || e.key === null) { memory = e.newValue || 'live'; window.dispatchEvent(new Event('aqi:modechange')); }
  });
  window.Demo = { SCEN, applyToTowns, applyToHouse, getMode, setMode };
})();

})();