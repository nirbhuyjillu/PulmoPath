(function(){
/* Demo smoke scenarios: window.Demo — overrides live AQI for testing/judging. */
(function () {
  const SCEN = [
    { id: 'live', label: 'Live air (real data)', desc: 'Real-time Open-Meteo readings.' },
    { id: 'moderate', label: 'Demo: Moderate 90 → 115', now: 90, peak: 115, dust: 0.02, desc: '80–101 now, worsening past 101 soon.' },
    { id: 'usg', label: 'Demo: USG 120', now: 120, peak: 130, dust: 0.02, desc: '101–150: lung/heart question path.' },
    { id: 'usg-blocked', label: 'Demo: USG 130 + dust storm', now: 130, peak: 140, dust: 0.5, desc: 'Go-out blocked by dust storm.' },
    { id: 'unhealthy', label: 'Demo: Unhealthy 160', now: 160, peak: 165, dust: 0.02, desc: '150–170 with-condition path.' },
    { id: 'hazard', label: 'Demo: Hazardous 185', now: 185, peak: 195, dust: 0.05, desc: 'Over 170: everyone moves.' }
  ];
  function hourlySeries(now, peak) {
    // 48-hour ramp: now → peak over ~6h, then easing back toward now.
    const arr = [];
    for (let h = 0; h < 48; h++) {
      const rise = Math.min(h / 6, 1);
      const fall = h > 12 ? Math.max(0, 1 - (h - 12) / 24) * 0.3 : 0;
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
    // Gradient: towns further down the list get cleaner air so Screen 4 has targets.
    return towns.map((t, i) => {
      const relief = Math.min(120, i * 9);
      const now = Math.max(28, s.now - relief);
      const peak = Math.max(30, s.peak - relief);
      return { ...t, now, pm25: Math.round(now * 0.4), dustNow: s.dust,
        dustHourly: dustSeries(s.dust), hourly: hourlySeries(now, peak), time: 'demo ' + s.label };
    });
  }
  function applyToHouse(house, id) {
    const s = SCEN.find((x) => x.id === id);
    if (!s || id === 'live' || !house) return house;
    return { ...house, aqi: s.now, hourly: hourlySeries(s.now, s.peak),
      dustNow: s.dust, dustHourly: dustSeries(s.dust), time: 'demo ' + s.label };
  }
  window.Demo = { SCEN, applyToTowns, applyToHouse };
})();

})();