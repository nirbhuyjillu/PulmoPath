(function(){
/* Screen 3 decision tree: window.Advisory */
(function () {
  function buildAdvice(o) {
    const soon = window.AqiApi.maxSoon(o.hourly, 12);
    const dustStorm = window.AqiApi.isDustStorm(o.dustNow, o.dustHourly);
    const blocked = dustStorm || (o.aqiNow != null && o.aqiNow > 125);
    const out = { soon, dustStorm, blocked, steps: [], goto4: false, ask: false };
    const n = o.aqiNow;
    if (n == null) { out.steps.push('Live AQI unavailable. Refresh to retry.'); return out; }
    if (n <= 80) out.steps.push('AQI ' + n + ' (Good). No precautions needed.');
    if (n > 80 && n < 101) {
      if (soon != null && soon > 101)
        out.steps.push('AQI ' + n + ' now, forecast to exceed 101 soon (peak ~' + soon + '): you may consider moving to a library for better air quality or switching to recirculation mode.');
      else out.steps.push('AQI ' + n + ' (Moderate). Sensitive people should shorten prolonged outdoor exertion.');
    }
    if (n >= 101 && n < 150) {
      if (o.hasCondition === null || o.hasCondition === undefined) {
        out.steps.push('AQI ' + n + '. Do you have a lung or heart condition? Answer below.');
        out.ask = true;
      } else if (o.hasCondition) {
        out.steps.push('AQI ' + n + ' with lung/heart condition: immediately switch to recirculation mode with closed windows and doors, or go to a community center or library now.');
        if (!blocked) out.goto4 = true;
        else out.steps.push('Going outside is NOT advised right now (dust storm or AQI >125). Shelter in place: seal windows/doors, recirculate, run purifiers/humidifiers.');
      } else out.steps.push('AQI ' + n + '. Limit outdoor activity; keep windows closed and follow the 80-101 precautions.');
    }
    if (n >= 150 && n < 170) {
      if (o.hasCondition) {
        out.steps.push('AQI ' + n + ' with lung/heart disease: go to a library immediately or move to the closest town with acceptable AQI.');
        if (!blocked) out.goto4 = true;
        else out.steps.push('Going outside is NOT advised right now. Shelter in place: seal windows/doors, recirculate, purifiers/humidifiers on.');
      } else out.steps.push('AQI ' + n + '. Follow the 101-150 sensitive-group protocol: limit outdoor activity and recirculate indoor air.');
    }
    if (n >= 170) {
      out.steps.push('AQI ' + n + ' (very unhealthy). Everyone should move to a zone with more acceptable AQI.');
      if (!blocked) out.goto4 = true;
      else out.steps.push('Travel is unsafe right now. Seal the home, recirculate, purifiers + humidifiers on max until safe to move.');
    }
    return out;
  }
  window.Advisory = { buildAdvice };
})();

})();