(function(){
/* Shared data: window.Towns */
(function () {
  const CENTER = { name: 'Tri-Cities, WA', lat: 46.28, lon: -119.28 };
  const TOWNS = [
    { name: 'Richland', lat: 46.2857, lon: -119.2845 },
    { name: 'Kennewick', lat: 46.2112, lon: -119.1372 },
    { name: 'Pasco', lat: 46.2396, lon: -119.1006 },
    { name: 'West Richland', lat: 46.2976, lon: -119.35 },
    { name: 'Finley', lat: 46.1753, lon: -119.0567 },
    { name: 'Benton City', lat: 46.2634, lon: -119.489 },
    { name: 'Burbank', lat: 46.1967, lon: -119.0078 },
    { name: 'Prosser', lat: 46.2067, lon: -119.7689 },
    { name: 'Grandview', lat: 46.2537, lon: -119.9019 },
    { name: 'Sunnyside', lat: 46.3215, lon: -120.0126 },
    { name: 'Granger', lat: 46.3418, lon: -120.1904 },
    { name: 'Zillah', lat: 46.4026, lon: -120.2632 },
    { name: 'Toppenish', lat: 46.3773, lon: -120.3087 },
    { name: 'Wapato', lat: 46.4465, lon: -120.4226 },
    { name: 'Walla Walla', lat: 46.0646, lon: -118.343 },
    { name: 'College Place', lat: 46.0462, lon: -118.386 },
    { name: 'Dayton', lat: 46.3181, lon: -117.9779 },
    { name: 'Connell', lat: 46.0087, lon: -118.86 },
    { name: 'Mesa', lat: 46.5768, lon: -119.0 },
    { name: 'Othello', lat: 46.8266, lon: -119.177 },
    { name: 'Mattawa', lat: 46.7373, lon: -119.9083 },
    { name: 'Hermiston, OR', lat: 45.84, lon: -119.2887 },
    { name: 'Umatilla, OR', lat: 45.9171, lon: -119.34 },
    { name: 'Stanfield, OR', lat: 45.7815, lon: -119.2181 },
    { name: 'Paterson', lat: 45.9372, lon: -119.5931 },
    { name: 'Plymouth', lat: 45.9379, lon: -119.3494 }
  ];
  function haversineMiles(aLat, aLon, bLat, bLon) {
    const R = 3958.8;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLon = ((bLon - aLon) * Math.PI) / 180;
    const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function townsWithin60() {
    return TOWNS.map((t) => ({ ...t, dist: haversineMiles(CENTER.lat, CENTER.lon, t.lat, t.lon) }))
      .filter((t) => t.dist <= 60).sort((a, b) => a.dist - b.dist);
  }
  function aqiColor(aqi) {
    if (aqi == null || Number.isNaN(aqi)) return '#64748b';
    if (aqi <= 50) return '#22c55e';
    if (aqi <= 100) return '#eab308';
    if (aqi <= 150) return '#f97316';
    if (aqi <= 200) return '#ef4444';
    if (aqi <= 300) return '#a855f7';
    return '#7f1d1d';
  }
  function aqiLabel(aqi) {
    if (aqi == null || Number.isNaN(aqi)) return 'Unknown';
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'USG';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }
  window.Towns = { CENTER, TOWNS, townsWithin60, haversineMiles, aqiColor, aqiLabel };
})();

})();