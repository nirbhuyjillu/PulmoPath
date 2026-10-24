(function(){
/* Live data: window.AqiApi */
(function () {
  async function fetchWindSpeeds(towns) {
    const lats = towns.map((t) => Number(t.lat).toFixed(4)).join(',');
    const lons = towns.map((t) => Number(t.lon).toFixed(4)).join(',');
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lats +
      '&longitude=' + lons + '&current=wind_speed_10m&wind_speed_unit=kmh&timezone=America%2FLos_Angeles';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather service returned ' + res.status);
    const payload = await res.json();
    const list = Array.isArray(payload) ? payload : [payload];
    return towns.map((town, index) => {
      const item = list[Math.min(index, list.length - 1)] || {};
      return {
        windSpeed: item.current ? (item.current.wind_speed_10m ?? null) : null,
        windTime: item.current ? (item.current.time ?? null) : null
      };
    });
  }

  async function fetchPointWindSpeed(lat, lon) {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
      '&longitude=' + lon + '&current=wind_speed_10m&wind_speed_unit=kmh&timezone=America%2FLos_Angeles';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather service returned ' + res.status);
    const payload = await res.json();
    return {
      windSpeed: payload.current ? (payload.current.wind_speed_10m ?? null) : null,
      windTime: payload.current ? (payload.current.time ?? null) : null
    };
  }

  async function fetchTownAQIs(towns) {
    const lats = towns.map((t) => t.lat.toFixed(4)).join(',');
    const lons = towns.map((t) => t.lon.toFixed(4)).join(',');
    const url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lats +
      '&longitude=' + lons + '&current=us_aqi,pm2_5,pm10,dust&hourly=us_aqi,dust' +
      '&forecast_hours=48&timezone=America%2FLos_Angeles';
    const [res, windResults] = await Promise.all([
      fetch(url),
      fetchWindSpeeds(towns).catch(() => towns.map(() => ({ windSpeed: null, windTime: null })))
    ]);
    if (!res.ok) throw new Error('AQI service returned ' + res.status);
    const arr = await res.json();
    const list = Array.isArray(arr) ? arr : [arr];
    return towns.map((t, i) => {
      const d = list[Math.min(i, list.length - 1)] || {};
      return { ...t,
        ...windResults[i],
        now: d.current ? (d.current.us_aqi ?? null) : null,
        pm25: d.current ? (d.current.pm2_5 ?? null) : null,
        dustNow: d.current ? (d.current.dust ?? null) : null,
        dustHourly: d.hourly ? d.hourly.dust : null,
        hourly: d.hourly ? d.hourly.us_aqi : null,
          time: d.current ? (d.current.time || new Date().toISOString()) : null };
          });
        }
  async function fetchPointAQI(lat, lon) {
    const url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat +
      '&longitude=' + lon + '&current=us_aqi,pm2_5,pm10,dust&hourly=us_aqi,dust' +
      '&forecast_hours=48&timezone=America%2FLos_Angeles';
    const [res, wind] = await Promise.all([
      fetch(url),
      fetchPointWindSpeed(lat, lon).catch(() => ({ windSpeed: null, windTime: null }))
    ]);
    if (!res.ok) throw new Error('AQI service returned ' + res.status);
    const d = await res.json();
    return {
      ...wind,
      now: d.current ? (d.current.us_aqi ?? null) : null,
      pm25: d.current ? (d.current.pm2_5 ?? null) : null,
      dustNow: d.current ? (d.current.dust ?? null) : null,
      dustHourly: d.hourly ? d.hourly.dust : null,
      hourly: d.hourly ? d.hourly.us_aqi : null,
      time: d.current ? d.current.time : null };
  }
  async function geocodeNominatim(q) {
    const url = 'https://nominatim.openstreetmap.org/search?q=' +
      encodeURIComponent(q) + '&format=jsonv2&addressdetails=1&limit=5&countrycodes=us';
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Address search returned ' + res.status);
    const d = await res.json();
    return (d || []).map((r) => ({
      label: r.display_name,
      lat: parseFloat(r.lat), lon: parseFloat(r.lon) }));
  }
  async function geocodeOpenMeteo(q) {
    const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(q) + '&count=5&language=en&format=json';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Search returned ' + res.status);
    const d = await res.json();
    return (d.results || []).map((r) => ({
      label: r.name + (r.admin1 ? ', ' + r.admin1 : ''),
      lat: r.latitude, lon: r.longitude }));
  }
  /* Any-format address search: full street + city + state via Nominatim,
     with Open-Meteo place-name geocoder as fallback. */
  async function geocodePlace(q) {
    const query = (q || '').trim();
    if (!query) return [];
    const tries = [query];
    // If user typed "street, city, state" without ZIP, also try with " USA" appended.
    if (!/\b\d{5}\b/.test(query) && !/\busa\b/i.test(query)) tries.push(query + ', USA');
    let lastErr = null;
    for (const t of tries) {
      try {
        const r = await geocodeNominatim(t);
        if (r.length) return r;
      } catch (e) { lastErr = e; }
    }
    try {
      // Fallback: bare place names like "Richland WA".
      const short = query.split(',').slice(-2).join(',').trim();
      const r = await geocodeOpenMeteo(short || query);
      if (r.length) return r;
    } catch (e) { lastErr = e; }
    if (lastErr && !navigator.onLine) throw lastErr;
    return [];
  }
  function maxSoon(hourly, hours) {
    if (!hourly || !hourly.length) return null;
    const vals = hourly.slice(0, hours || 12).filter((v) => v != null);
    return vals.length ? Math.max.apply(null, vals) : null;
  }
  function isDustStorm(dustNow, dustHourly) {
    const vals = [dustNow].concat((dustHourly || []).slice(0, 6)).filter((v) => v != null);
    if (!vals.length) return false;
    return Math.max.apply(null, vals) > 0.3;
  }
  async function fastestRoute(from, to) {
    const url = 'https://router.project-osrm.org/route/v1/driving/' + from.lon + ',' + from.lat +
      ';' + to.lon + ',' + to.lat + '?overview=full&geometries=geojson';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Routing returned ' + res.status);
    const d = await res.json();
    const r = d.routes && d.routes[0];
    if (!r) throw new Error('No route found');
    return { km: r.distance / 1000, minutes: r.duration / 60,
      line: r.geometry.coordinates.map((c) => [c[1], c[0]]) };
  }
  function googleMapsLink(from, to) {
    return 'https://www.google.com/maps/dir/?api=1&origin=' + from.lat + ',' + from.lon +
      '&destination=' + to.lat + ',' + to.lon + '&travelmode=driving';
  }
  window.AqiApi = { fetchTownAQIs, fetchPointAQI, fetchWindSpeeds, fetchPointWindSpeed, geocodePlace, maxSoon, isDustStorm, fastestRoute, googleMapsLink };
})();

})();