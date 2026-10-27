(function(){
/* Screen 3 decision tree: window.Advisory */
(function () {
  function buildAdvice(o) {
    const soon = window.AqiApi.maxSoon(o.hourly, 12);
    // Dust concentration alone cannot establish a dust storm or road safety.
    const dustStorm = o.dustEvent === true;
    const blocked = dustStorm;
    const out = { soon, dustStorm, blocked, steps: [], goto4: false, ask: false };
    const n = o.aqiNow;
    if (n == null || !Number.isFinite(n)) { out.steps.push('Air-quality data is unavailable. Refresh to retry. In the meantime, follow local air-quality alerts and your care plan.'); return out; }
    out.steps.push('AQI ' + n + ': ' + window.Towns.aqiLabel(n) + '.');
    if (n <= 50) out.steps.push('Air quality is generally satisfactory. Pay attention to symptoms and follow your usual care plan.');
    else if (n <= 100) out.steps.push('Most people can continue usual activities. People unusually sensitive to air pollution should consider shorter or less intense outdoor activity.');
    else if (n <= 150) out.steps.push('Sensitive groups should reduce prolonged or heavy outdoor exertion, take breaks, and watch for symptoms.');
    else if (n <= 200) out.steps.push('Everyone should reduce prolonged or heavy outdoor exertion. Sensitive groups should avoid it and choose cleaner indoor air.');
    else if (n <= 300) out.steps.push('Everyone should avoid prolonged or heavy outdoor exertion. Sensitive groups should avoid outdoor physical activity.');
    else out.steps.push('Avoid outdoor physical activity. Stay in cleaner indoor air and follow official emergency guidance.');
    if (o.hasCondition === true) out.steps.push('With a heart or lung condition, follow your clinician-provided action plan and keep prescribed medicines available. Contact your care team if symptoms develop or worsen.');
    if (o.hasCondition == null && n > 100) out.steps.push('Children, older adults, pregnant people, and people with heart or lung disease may need extra precautions.');
    if (soon != null && soon > n && soon > 100) out.steps.push('Air quality may worsen over the next 12 hours, with a forecast peak AQI of ' + soon + '. Plan outdoor activities for a cleaner time.');
    if (n > 100) out.steps.push('During smoke, keep windows closed if it is safe to do so, use recirculation, and run a suitable air cleaner. Avoid overheating. Check for an officially designated cleaner-air space if your indoor air is poor.');
    if (dustStorm) out.steps.push('This scenario includes blowing dust. Stay indoors where possible and check official visibility and road alerts; the app cannot assess travel safety.');
    return out;
  }
  window.Advisory = { buildAdvice };
})();

})();