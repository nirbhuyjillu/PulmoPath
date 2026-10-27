(function(){
/* Page 6: About — data sources, how to use, disclaimer */
function About() {
  return (
    <section className="prose">
      <h1>Local information. Clear limitations.</h1>
      <p className="page-intro">Pulmopath: When the Air Turns Unhealthy, Find a Cleaner Path. helps you explore air-quality forecasts around Richland, Kennewick, Pasco, and nearby communities within 60 miles.</p>
      <div className="card">
        <h2>A simple way to get started</h2>
        <ul>
          <li><a className="text-link" href="index.html">Live forecast</a>: select a town, search an address, use your location, or select the map. Your chosen location carries through to health guidance and the route model.</li>
          <li><a className="text-link" href="advisor.html">Health advisor</a>: see exposure-reduction guidance for your location, with optional guidance for people sensitive to air pollution.</li>
          <li><a className="text-link" href="regression.html">Driving route advisor</a>: compare nearby air conditions using an educational peak-flow model. This model is trained on simulated data and is not clinically validated.</li>
          <li><a className="text-link" href="scenarios.html">Demo scenarios</a>: apply simulated smoke and wind conditions throughout the app. The driving route advisor also loads fictional sample peak-flow inputs and automatically recalculates its comparison. These are not measurements of your health. Changing scenarios updates open pages; returning to live clears demo results and restores any live inputs still held on the route page. A banner clearly identifies demo mode on every page.</li>
        </ul>
        <p>Use <strong>Speak aloud</strong> at the top of any page to hear its current content. Select Stop reading to stop. Browser speech support varies.</p>
      </div>
      <div className="card">
        <h2>Where the information comes from</h2>
        <ul>
          <li><a className="text-link" href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">Open-Meteo Air Quality</a> supplies modeled US AQI and fine particles (PM2.5). These are regional forecasts, not measurements at your front door.</li>
          <li><a className="text-link" href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Open-Meteo Weather</a> supplies modeled wind speed. Wind alone cannot establish smoke direction or travel safety.</li>
          <li>OpenStreetMap provides map tiles and address search through Nominatim; Open-Meteo provides fallback place search. OSRM provides driving estimates. Google Maps opens directions when you choose that link.</li>
          <li>The map shows a curated town list within 60 straight-line miles of central Tri-Cities. Town distances are not driving distances. Forecast charts show 24 hours and peak summaries cover 12 hours.</li>
        </ul>
        <p>Forecasts refresh about every 10 minutes; route conditions refresh about every 15 minutes. Updates may be delayed or unavailable. Map tiles, searches, forecasts, and driving directions need internet access. Demo air and wind do not require live forecast requests, but the app's external libraries still need to load.</p>
      </div>
      <div className="card">
        <h2>Your location and privacy</h2>
        <p>Your chosen location and demo preference are saved in this browser, when browser storage is available. Use Clear location on Live forecast to remove the saved location. Sensitivity answers and peak-flow inputs are not saved by this app.</p>
        <p>Location access is requested only when you select Use my location. Coordinates are sent to the forecast and routing providers when needed; address searches are sent to geocoding providers. Opening Google Maps shares the route endpoints with Google. Do not enter information you do not want these providers to receive.</p>
      </div>
      <div className="card">
        <h2>Use this as information, not an emergency system</h2>
        <p>AQI is not a diagnosis. The route model cannot predict an individual's response to moving, assess smoke along a road, or account for visibility and road closures. A cleaner modeled destination is not a guarantee of safe travel. Do not delay medical care to use this app.</p>
        <p>Follow your clinician's care plan and official local alerts. For current public guidance, visit <a className="text-link" href="https://www.airnow.gov/" target="_blank" rel="noreferrer">AirNow</a> and <a className="text-link" href="https://www.weather.gov/" target="_blank" rel="noreferrer">National Weather Service</a>.</p>
      </div>
      <div className="actions"><a className="btn primary" href="index.html">Check your local forecast</a><a className="btn" href="scenarios.html">Try a demo</a></div>
    </section>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<About />);

})();