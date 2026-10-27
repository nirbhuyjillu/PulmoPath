(function(){
/* Live data: window.AqiApi */
(function () {
  // Bound network waits so every loading state can recover with a retry.
  const fetch = (url, options = {}) => window.fetch(url, {
    ...options,
    ...(typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(15000) } : {})
  });
  function connectionMessage(error) {
    if (error.status === 429) return 'Open-Meteo request limit reached. Wait a minute, then retry.';
    if (error.status) return 'Open-Meteo returned HTTP ' + error.status + '. ' + (error.reason || 'Please retry shortly.');
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'Open-Meteo took too long to respond. Please retry.';
    if (error.message === 'Missing current AQI') return 'Open-Meteo did not provide current air quality for this location. Please retry shortly.';
    return 'Could not reach Open-Meteo. Check your connection or whether a browser extension is blocking air-quality-api.open-meteo.com, then retry.';
  }
  async function fetchAirQuality(url) {
    // Retry one transient failure, but never hammer a rate-limited service.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok || data?.error) {
          const error = new Error('Air-quality request failed');
          error.status = res.status; error.reason = data?.reason;
          throw error;
        }
        if (!data) throw new Error('Invalid air-quality response');
        return data;
      } catch (error) {
        if (attempt === 0 && (!error.status || error.status >= 500)) continue;
        throw new Error(connectionMessage(error));
      }
    }
  }
  function airReading(d) {
    return {
      now: Number.isFinite(d?.current?.us_aqi) ? d.current.us_aqi : null,
      pm25: d?.current?.pm2_5 ?? null,
      dustNow: d?.current?.dust ?? null,
      dustHourly: d?.hourly?.dust ?? null,
      hourly: d?.hourly?.us_aqi ?? null,
      // Open-Meteo's ISO strings have no zone suffix. Apply the response offset,
      // not the device timezone, so arrival forecasts work for travelers too.
      hourlyTimes: (d?.hourly?.time || []).map(t => typeof t === 'number' ? t * 1000 : Date.parse(t + 'Z') - (d.utc_offset_seconds || 0) * 1000),
      time: d?.current?.time ?? null,
      source: 'open-meteo'
    };
  }
  async function fetchWindSpeeds(towns) {
    if (window.Demo && window.Demo.getMode() !== 'live') return window.Demo.applyToTowns(towns, window.Demo.getMode()).map(t => ({ windSpeed: t.windSpeed, windTime: t.windTime, source: t.source, scenarioId: t.scenarioId }));
    const lats = towns.map((t) => Number(t.lat).toFixed(4)).join(',');
    const lons = towns.map((t) => Number(t.lon).toFixed(4)).join(',');
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lats +
      '&longitude=' + lons + '&current=wind_speed_10m&wind_speed_unit=kmh&timezone=America%2FLos_Angeles';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather service returned ' + res.status);
    const payload = await res.json();
    const list = Array.isArray(payload) ? payload : [payload];
    return towns.map((town, index) => {
      const item = list[index] || {};
      return {
        windSpeed: item.current ? (item.current.wind_speed_10m ?? null) : null,
        windTime: item.current ? (item.current.time ?? null) : null
      };
    });
  }

  async function fetchPointWindSpeed(lat, lon) {
    if (window.Demo && window.Demo.getMode() !== 'live') {
      const point = window.Demo.applyToHouse({ lat, lon }, window.Demo.getMode());
      return { windSpeed: point.windSpeed, windTime: point.windTime, source: point.source, scenarioId: point.scenarioId };
    }
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

  async function fetchTownAQIs(towns, { includeWind = true } = {}) {
    if (!towns.length) return [];
    if (window.Demo && window.Demo.getMode() !== 'live') return window.Demo.applyToTowns(towns, window.Demo.getMode());
    const lats = towns.map((t) => t.lat.toFixed(4)).join(',');
    const lons = towns.map((t) => t.lon.toFixed(4)).join(',');
    const url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lats +
      '&longitude=' + lons + '&current=us_aqi,pm2_5,pm10,dust&hourly=us_aqi,dust' +
      '&forecast_hours=48&timezone=America%2FLos_Angeles';
    const [arr, windResults] = await Promise.all([
      fetchAirQuality(url),
      includeWind ? fetchWindSpeeds(towns).catch(() => []) : Promise.resolve([])
    ]);
    const list = Array.isArray(arr) ? arr : [arr];
    const readings = towns.map((t, i) => ({ ...t, ...windResults[i], ...airReading(list[i]) }));
    if (!readings.some(t => t.now !== null)) throw new Error(connectionMessage(new Error('Missing current AQI')));
    return readings;
  }
  async function fetchPointAQI(lat, lon, { includeWind = true } = {}) {
    if (window.Demo && window.Demo.getMode() !== 'live') {
      return window.Demo.applyToHouse({ lat, lon }, window.Demo.getMode());
    }
    const url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat +
      '&longitude=' + lon + '&current=us_aqi,pm2_5,pm10,dust&hourly=us_aqi,dust' +
      '&forecast_hours=48&timezone=America%2FLos_Angeles';
    const [d, wind] = await Promise.all([
      fetchAirQuality(url),
      includeWind ? fetchPointWindSpeed(lat, lon).catch(() => ({ windSpeed: null, windTime: null })) : Promise.resolve({})
    ]);
    const reading = airReading(d);
    if (reading.now === null) throw new Error(connectionMessage(new Error('Missing current AQI')));
    return { ...wind, ...reading };
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
    if (lastErr) throw new Error('Address search is unavailable. Choose a nearby town or try again.');
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
    for (const place of [from, to]) {
      if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon) || Math.abs(place.lat) > 90 || Math.abs(place.lon) > 180) throw new Error('Invalid directions location. Please choose a location again.');
    }
    // Preserve the same exact destination used for the forecast and OSRM route.
    return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(from.lat + ',' + from.lon) +
      '&destination=' + encodeURIComponent(to.lat + ',' + to.lon) + '&travelmode=driving';
  }
  // Google's own search for libraries near a point; needs no third-party lookup.
  function googleMapsLibrarySearchLink(from) {
    if (!Number.isFinite(from.lat) || !Number.isFinite(from.lon) || Math.abs(from.lat) > 90 || Math.abs(from.lon) > 180) throw new Error('Invalid directions location. Please choose a location again.');
    return 'https://www.google.com/maps/search/' + encodeURIComponent('library') + '/@' + from.lat + ',' + from.lon + ',12z';
  }
  function arrivalOutlook(reading, minutes, departure = Date.now()) {
    if (!Number.isFinite(minutes) || minutes < 0 || !Number.isFinite(departure)) return null;
    const arrival = departure + minutes * 60000, end = arrival + 6 * 3600000;
    const times = reading.hourlyTimes || [], values = reading.hourly || [];
    const index = times.findIndex(t => Number.isFinite(t) && t <= arrival && arrival < t + 3600000);
    if (index < 0 || !Number.isFinite(values[index])) return null;
    const samples = [];
    let coveredUntil = times[index];
    for (let i = index; i < times.length && times[i] < end; i++) {
      if (!Number.isFinite(times[i]) || times[i] !== coveredUntil || !Number.isFinite(values[i])) break;
      samples.push({ time: times[i], aqi: values[i] });
      coveredUntil = times[i] + 3600000;
    }
    const peak = samples.length ? Math.max(...samples.map(s => s.aqi)) : values[index];
    return { arrival, atArrival: values[index], peak, complete: coveredUntil >= end,
      firstPoor: samples.find(s => s.aqi > 100) || null, source: reading.source };
  }
  async function nearestLibrary(from) {
    if (!Number.isFinite(from.lat) || !Number.isFinite(from.lon) || Math.abs(from.lat) > 90 || Math.abs(from.lon) > 180) throw new Error('Choose a starting location on Live forecast first.');
    const limit = 50000 / 1609.344;
    const signal = () => typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(20000) } : {};
    const query = `[out:json][timeout:15];(node["amenity"="library"](around:50000,${from.lat},${from.lon});way["amenity"="library"](around:50000,${from.lat},${from.lon});relation["amenity"="library"](around:50000,${from.lat},${from.lon}););out center tags;`;
    const mirrors = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
    const overpass = mirrors.map(async mirror => {
      const response = await window.fetch(mirror, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query), ...signal() });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const json = await response.json();
      if (!Array.isArray(json.elements)) throw new Error('bad response');
      // Overpass can return a remark with partial data; only trust it if something was found.
      if (json.remark && !json.elements.length) throw new Error('incomplete');
      return json.elements.map(item => {
        const tags = item.tags || {};
        return { lat: item.lat ?? item.center?.lat, lon: item.lon ?? item.center?.lon, name: tags.name,
          address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' '), access: tags.access };
      });
    });
    // Independent backup source: Nominatim geocoder restricted to a box around the start.
    const dLat = 50000 / 111320, dLon = dLat / Math.max(0.2, Math.cos(from.lat * Math.PI / 180));
    const nominatim = (async () => {
      const box = [from.lon - dLon, from.lat + dLat, from.lon + dLon, from.lat - dLat].join(',');
      const response = await window.fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=40&bounded=1&q=library&viewbox=' + box, { headers: { Accept: 'application/json' }, ...signal() });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('bad response');
      return rows.map(r => ({ lat: Number(r.lat), lon: Number(r.lon), name: r.name || String(r.display_name || '').split(',')[0], address: '' }));
    })();
    let found = null;
    try { found = await Promise.any([...overpass, nominatim]); } catch (_) { found = null; }
    if (!found) throw new Error('The library search service is busy or unreachable right now.');
    const libraries = found.filter(item => item.access !== 'private' && item.access !== 'no').map(item => ({
      lat: item.lat, lon: item.lon, name: item.name || 'Mapped library', address: item.address,
      miles: Number.isFinite(item.lat) && Number.isFinite(item.lon) ? window.Towns.haversineMiles(from.lat, from.lon, item.lat, item.lon) : Infinity
    })).filter(item => Number.isFinite(item.miles) && item.miles <= limit)
      .sort((a, b) => a.miles - b.miles);
    if (!libraries.length) throw new Error('No mapped library found within 31 miles. Try a different starting location or check your local library directory.');
    return libraries[0];
  }
  window.AqiApi = { fetchTownAQIs, fetchPointAQI, fetchWindSpeeds, fetchPointWindSpeed, geocodePlace, maxSoon, isDustStorm, fastestRoute, googleMapsLink, googleMapsLibrarySearchLink, arrivalOutlook, nearestLibrary };
})();

})();