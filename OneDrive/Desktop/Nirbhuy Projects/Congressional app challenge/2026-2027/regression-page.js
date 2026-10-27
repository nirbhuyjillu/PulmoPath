(async function () {
  'use strict';

  const T = window.Towns;
  const API = window.AqiApi;
  const Model = window.PEFNeuralModel;
  const towns = T.townsWithin60();
  const modelStatus = document.getElementById('model-status');
  const personalBestInput = document.getElementById('personal-best');
  const currentPEFInput = document.getElementById('current-pef');
  const dataStatus = document.getElementById('data-status');
  const cityCount = document.getElementById('city-count');
  const originPM25Label = document.getElementById('origin-pm25');
  const originWindLabel = document.getElementById('origin-wind');
  const updatedTime = document.getElementById('updated-time');
  const cityList = document.getElementById('city-list');
  const findRouteButton = document.getElementById('find-route');
  const routeStatus = document.getElementById('route-status');
  const routeResult = document.querySelector('.route-output .route-result');
  const pefWarning = document.getElementById('pef-health-warning');
  const inputError = document.getElementById('input-error');
  if (modelStatus) modelStatus.textContent = 'Loading educational model...';
  let artifact;
  try {
    artifact = await Model.load();
  } catch (error) {
    if (modelStatus) {
      modelStatus.textContent = 'Trained model unavailable';
      modelStatus.classList.add('model-error');
    }
    if (dataStatus) dataStatus.textContent = 'Model load failed';
    if (routeStatus) routeStatus.textContent = `${error.message} Run train_pef_model.py to create the browser model artifact.`;
    if (findRouteButton) findRouteButton.disabled = true;
    return;
  }
  let liveCities = [];
  let origin = { ...T.CENTER, label: 'Tri-Cities, WA' };
  let startingPM25 = null;
  let startingWindSpeed = null;
  let refreshing = false;
  let routeCompleted = false;
  let bestDestination = null;
  let dataRequest = 0, routeRequest = 0, routing = false;
  let inputMode = 'live';
  let liveInputs = null;
  function syncScenarioInputs() {
    const mode = window.Demo.getMode();
    const scenario = window.Demo.SCEN.find(s => s.id === mode);
    if (mode !== inputMode) {
      if (mode !== 'live') {
        if (inputMode === 'live') liveInputs = { best: personalBestInput.value, current: currentPEFInput.value };
        personalBestInput.value = String(scenario.personalBest);
        currentPEFInput.value = String(scenario.currentPEF);
      } else {
        personalBestInput.value = liveInputs?.best || '';
        currentPEFInput.value = liveInputs?.current || '';
        liveInputs = null;
      }
      inputMode = mode;
    }
    const demo = mode !== 'live';
    const note = document.getElementById('demo-model-note');
    note.hidden = !demo;
    note.textContent = demo ? `${scenario.label}: sample personal best ${scenario.personalBest} L/min and current PEF ${scenario.currentPEF} L/min. These are fictional demonstration inputs, not estimates of your health. You can edit them; changing scenario resets the samples. Returning to live restores your previous inputs on this page. ${scenario.dustEvent ? 'This scenario includes blowing dust; check official visibility and road alerts. ' : ''}Driving times, if available, come from the real route service.` : '';
    setText('personal-best-label', demo ? 'Sample personal-best PEF' : 'Personal-best PEF');
    setText('current-pef-label', demo ? 'Sample current PEF' : "Patient's current PEF");
    setText('conditions-source', demo ? `Simulated AQI, PM2.5 and wind for ${scenario.label}. The same location has the same demo readings on Live forecast and Health advisor.` : 'Current PM2.5 and wind are supplied by Open-Meteo Air Quality and Weather.');
  }

  const training = artifact.training;
  const tuning = training.hyperparameter_selection;
  if (modelStatus) {
    modelStatus.textContent = 'Educational model ready / not clinically validated';
    modelStatus.title = `Article-pattern simulation based on Jacobson et al. (PMID 22683314); ${training.generated_rows} synthetic repeated measurements. Holdout metrics are for simulated subjects only, not clinical validation.`;
  }
  setText('model-pm25-range', `${artifact.normalization.pm25_min.toFixed(1)}–${artifact.normalization.pm25_max.toFixed(1)}`);
  setText('model-wind-range', `${artifact.normalization.wind_speed_min.toFixed(0)}–${artifact.normalization.wind_speed_max.toFixed(0)}`);
  setText('model-training-count', String(training.training_rows));
  setText('model-test-count', String(training.testing_rows));
  setText('model-training-subjects', String(training.training_subjects));
  setText('model-testing-subjects', String(training.testing_subjects));
  setText('model-test-mae', `${training.testing_metrics.mae_l_min_synthetic_only.toFixed(2)} L/min`);
  setText('model-test-r2', `${(training.testing_metrics.r_squared_synthetic_only * 100).toFixed(2)}%`);
  setText('model-selected-params',
    `${tuning.selected.hidden_size} hidden · ${tuning.selected.epochs} epochs · ` +
    `LR ${tuning.selected.learning_rate} · ${Math.round(tuning.selected.dropout_rate * 100)}% dropout`);
  setText('model-tuning-mae', `${tuning.ranked_results[0].validation_metrics.mae_l_min_synthetic_only.toFixed(2)} L/min`);
  setText('model-tuning-count', String(tuning.candidate_count));

  function drawMetricChart(svgId, history, metricKey, axisLabel, decimals) {
    const svg = document.getElementById(svgId);
    if (!svg) return false;
    const namespace = 'http://www.w3.org/2000/svg';
    const width = 720;
    const height = 260;
    const margin = { top: 16, right: 18, bottom: 38, left: 66 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const series = [
      { key: `training_${metricKey}`, className: 'chart-training' },
      { key: `validation_${metricKey}`, className: 'chart-validation' }
    ].map((item) => ({ ...item, values: history.map((row) => Number(row[item.key])) }))
      .filter((item) => item.values.every(Number.isFinite));
    const allValues = series.flatMap((item) => item.values);
    if (!allValues.length) return false;
    let minimum = Math.min(...allValues);
    let maximum = Math.max(...allValues);
    const padding = Math.max((maximum - minimum) * 0.12, Math.abs(maximum) * 0.02, 0.001);
    minimum -= padding;
    maximum += padding;
    if (minimum === maximum) maximum = minimum + 1;

    function addSvg(tag, attrs, text) {
      const element = document.createElementNS(namespace, tag);
      Object.entries(attrs || {}).forEach(([key, value]) => element.setAttribute(key, String(value)));
      if (text !== undefined) element.textContent = text;
      svg.append(element);
      return element;
    }

    svg.replaceChildren();
    for (let tick = 0; tick <= 4; tick++) {
      const ratio = tick / 4;
      const y = margin.top + ratio * plotHeight;
      const value = maximum - ratio * (maximum - minimum);
      addSvg('line', { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: 'chart-grid', stroke: '#29465a', 'stroke-width': 1 });
      addSvg('text', { x: margin.left - 9, y: y + 4, 'text-anchor': 'end', class: 'chart-label', fill: '#9db8cc', 'font-size': 12 }, value.toFixed(decimals));
    }
    addSvg('line', { x1: margin.left, y1: margin.top, x2: margin.left, y2: height - margin.bottom, class: 'chart-axis', stroke: '#7591a7', 'stroke-width': 1.2 });
    addSvg('line', { x1: margin.left, y1: height - margin.bottom, x2: width - margin.right, y2: height - margin.bottom, class: 'chart-axis', stroke: '#7591a7', 'stroke-width': 1.2 });
    addSvg('text', { x: margin.left + plotWidth / 2, y: height - 6, 'text-anchor': 'middle', class: 'chart-label', fill: '#9db8cc', 'font-size': 12 }, 'Epoch');
    addSvg('text', { x: 16, y: margin.top + plotHeight / 2, transform: `rotate(-90 16 ${margin.top + plotHeight / 2})`, 'text-anchor': 'middle', class: 'chart-label', fill: '#9db8cc', 'font-size': 12 }, axisLabel);

    const epochCount = history.length;
    const xForIndex = (index) => margin.left + (epochCount <= 1 ? 0.5 : index / (epochCount - 1)) * plotWidth;
    series.forEach((item) => {
      const path = item.values.map((value, index) => {
        const x = xForIndex(index);
        const y = margin.top + (maximum - value) / (maximum - minimum) * plotHeight;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' ');
      addSvg('path', {
        d: path,
        class: item.className,
        fill: 'none',
        stroke: item.key.startsWith('training_') ? '#38bdf8' : '#fbbf24',
        'stroke-width': 3,
        'stroke-dasharray': item.key.startsWith('training_') ? 'none' : '7 4',
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round'
      });
    });
    return true;
  }

  const epochHistory = training.epoch_history || [];
  const r2Drawn = drawMetricChart('r2-curve', epochHistory, 'r_squared', 'R²', 3);
  const mseDrawn = drawMetricChart('mse-curve', epochHistory, 'mse', 'MSE (L/min)²', 1);
  setText('curve-status', r2Drawn && mseDrawn
    ? `Showing ${epochHistory.length} epochs from an inner split of ${training.hyperparameter_selection.validation_subjects} validation subjects; the final ${training.testing_subjects} test subjects are excluded.`
    : 'Epoch history is missing. Retrain with train_pef_model.py to generate the curves.');

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function validPositiveInput(input) {
    const value = Number(input.value);
    return input.value.trim() !== '' && Number.isFinite(value) && value >= 1 && value <= 1000 && input.validity.valid ? value : null;
  }

  function setRouteMessage(message) {
    window.RouteActions.reset();
    routeCompleted = false;
    bestDestination = null;
    if (pefWarning) pefWarning.hidden = true;
    routeStatus.textContent = message;
    routeStatus.hidden = false;
    routeResult.hidden = true;
  }

  function updateButtonState() {
    const bothInputsValid = validPositiveInput(personalBestInput) !== null &&
      validPositiveInput(currentPEFInput) !== null;
    const originConditionsAvailable = Number.isFinite(startingPM25) && Number.isFinite(startingWindSpeed);
    findRouteButton.disabled = !bothInputsValid || !liveCities.length ||
      !originConditionsAvailable || refreshing || routing;
    if (routing || refreshing) return;
    if (routeCompleted && bothInputsValid && originConditionsAvailable && !refreshing) {
      return;
    }
    if (!bothInputsValid) {
      inputError.textContent = personalBestInput.value || currentPEFInput.value
        ? 'Enter whole-number measurements between 1 and 1,000 L/min.'
        : '';
      inputError.hidden = !inputError.textContent;
      setRouteMessage('Enter the personal-best and current PEF measurements to compare routes.');
    } else {
      inputError.textContent = '';
      inputError.hidden = true;
      if (!liveCities.length) {
        setRouteMessage('Nearby readings are unavailable. Use Refresh conditions to retry.');
      } else if (startingPM25 === null || startingWindSpeed === null) {
        setRouteMessage('Nearby readings loaded, but current PM2.5 or wind speed at the starting location is unavailable.');
      } else if (startingPM25 < artifact.normalization.pm25_min ||
          startingPM25 > artifact.normalization.pm25_max ||
          startingWindSpeed < artifact.normalization.wind_speed_min ||
          startingWindSpeed > artifact.normalization.wind_speed_max) {
        setRouteMessage('Ready to compare cities. Current conditions fall outside the experimental model range; estimates will be limited to that range and are especially uncertain.');
      } else {
        setRouteMessage(`Ready to compare ${liveCities.length} nearby city readings. Starting conditions at ${origin.label}: PM2.5 ${startingPM25.toFixed(1)} μg/m³, wind ${startingWindSpeed.toFixed(1)} km/h.`);
      }
    }
  }

  function renderCityList() {
    cityList.replaceChildren();
    const sorted = liveCities.slice().sort((a, b) => {
      if (a.pm25 == null) return 1;
      if (b.pm25 == null) return -1;
      return a.pm25 - b.pm25;
    });
    if (!sorted.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = 'No air-quality and wind readings available.';
      row.append(cell);
      cityList.append(row);
      return;
    }
    sorted.forEach((city) => {
      const row = document.createElement('tr');
      [city.name,
        city.pm25 == null ? '—' : `${Number(city.pm25).toFixed(1)} μg/m³`,
        city.windSpeed == null ? '—' : `${Number(city.windSpeed).toFixed(1)} km/h`,
        city.now == null ? '—' : Math.round(city.now)].forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      cityList.append(row);
    });
  }

  function getSavedOrigin() {
    try {
      const saved = JSON.parse(localStorage.getItem('aqi-house') || 'null');
      if (saved && Number.isFinite(Number(saved.lat)) && Number.isFinite(Number(saved.lon))) {
        return { lat: Number(saved.lat), lon: Number(saved.lon), label: /\(-?\d+\.\d+,/.test(saved.label) ? 'Your selected location' : saved.label || 'Your selected location' };
      }
    } catch (error) {
      // Ignore invalid local storage and use the app's default region center.
    }
    return { ...T.CENTER, label: 'Tri-Cities, WA (default origin)' };
  }

  function distanceFromOrigin(city) {
    return T.haversineMiles(origin.lat, origin.lon, city.lat, city.lon);
  }

  async function refreshLiveData() {
    window.RouteActions.resetLibrary();
    syncScenarioInputs();
    const request = ++dataRequest;
    ++routeRequest; routing = false; routeCompleted = false;
    refreshing = true;
    liveCities = []; startingPM25 = null; startingWindSpeed = null;
    renderCityList();
    originPM25Label.textContent = 'Checking starting air quality...';
    originWindLabel.textContent = 'Checking wind...';
    cityCount.textContent = '--'; updatedTime.textContent = 'Updating...';
    routeResult.hidden = true;
    findRouteButton.textContent = 'Compare nearby cities';
    setRouteMessage('Updating nearby conditions...');
    dataStatus.textContent = window.Demo.getMode() === 'live' ? 'Refreshing forecast...' : 'Applying demo conditions...';
    findRouteButton.disabled = true;
    try {
      const fetched = await API.fetchTownAQIs(towns);
      if (request !== dataRequest) return;
      liveCities = fetched;
      origin = getSavedOrigin();
      const savedHome = origin.label !== 'Tri-Cities, WA (default origin)';
      if (savedHome) {
        try {
          const point = await API.fetchPointAQI(origin.lat, origin.lon);
          if (request !== dataRequest) return;
          startingPM25 = point.pm25;
          startingWindSpeed = point.windSpeed;
        } catch (error) {
          if (request !== dataRequest) return;
          startingPM25 = null;
          startingWindSpeed = null;
        }
        if (startingWindSpeed == null) {
          try {
            const wind = await API.fetchPointWindSpeed(origin.lat, origin.lon);
            if (request !== dataRequest) return;
            startingWindSpeed = wind.windSpeed;
          } catch (error) {
            if (request !== dataRequest) return;
            startingWindSpeed = null;
          }
        }
      } else {
        const nearest = liveCities
          .filter((city) => city.pm25 != null && city.windSpeed != null)
          .sort((a, b) => distanceFromOrigin(a) - distanceFromOrigin(b))[0];
        if (nearest) {
          startingPM25 = Number(nearest.pm25);
          startingWindSpeed = Number(nearest.windSpeed);
        }
      }
      const available = liveCities.filter((city) => city.pm25 != null && city.windSpeed != null).length;
      cityCount.textContent = String(available);
      originPM25Label.textContent = startingPM25 == null
        ? 'Origin PM2.5: unavailable'
        : `Origin PM2.5: ${Number(startingPM25).toFixed(1)} μg/m³`;
      originWindLabel.textContent = startingWindSpeed == null
        ? 'Origin wind: unavailable'
        : `Origin wind: ${Number(startingWindSpeed).toFixed(1)} km/h`;
      const time = liveCities.find((city) => city.time)?.time;
      updatedTime.textContent = time ? `updated ${time}` : 'just updated';
      const scenario = window.Demo.SCEN.find(s => s.id === window.Demo.getMode());
      dataStatus.textContent = `${scenario.id === 'live' ? 'Forecast' : 'Simulated: ' + scenario.label} / ${available} towns with air and wind data`;
      setText('origin-label', 'Starting location: ' + origin.label);
      renderCityList();
      updateButtonState();
    } catch (error) {
      if (request !== dataRequest) return;
      dataStatus.textContent = 'Conditions unavailable';
      setRouteMessage('Could not load nearby conditions. Check your connection and use Refresh conditions to retry.');
    } finally {
      if (request === dataRequest) {
        refreshing = false; updateButtonState();
        if (window.Demo.getMode() !== 'live' && !findRouteButton.disabled) compareCities(false);
      }
    }
  }

  function setOutput(ids, value) {
    for (const id of Array.isArray(ids) ? ids : [ids]) {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
        return;
      }
    }
  }

  function showBestMatch(city, personalBest, currentPEF, threshold, route) {
    const scenario = window.Demo.SCEN.find(s => s.id === window.Demo.getMode());
    setText('result-source', scenario.id === 'live' ? 'Comparison uses Open-Meteo conditions and your entered measurements.' : `Demo result: ${scenario.label}. Simulated air and wind; sample PEF inputs. Not a personal health prediction.${scenario.dustEvent ? ' Blowing dust is simulated; this route does not establish travel safety.' : ''}`);
    routeResult.dataset.scenario = scenario.id;
    const pm25 = Number(city.pm25);
    setOutput('destination-name', city.name);
    setOutput(['destination-pm25', 'destination-pm25-alt'], `${pm25.toFixed(1)} μg/m³`);
    setOutput('destination-pef', `${city.modeledPEF.toFixed(1)} L/min`);
    setOutput(['destination-threshold', 'destination-threshold-alt'], `${threshold.toFixed(1)} L/min`);
    setOutput(['destination-gap', 'destination-gap-alt'], `${city.gap.toFixed(1)} L/min`);
    const supportNote = document.getElementById('model-support-note') ||
      document.getElementById('model-support-note-alt');
    if (supportNote) {
      supportNote.hidden = !city.supportAdjusted;
      supportNote.textContent = city.supportAdjusted
      ? `Boundary-saturated estimate: at least one PM2.5/wind value was outside the synthetic model range. The model used the nearest boundary value (PM2.5 ${artifact.normalization.pm25_min.toFixed(1)}–${artifact.normalization.pm25_max.toFixed(1)} μg/m³; wind ${artifact.normalization.wind_speed_min.toFixed(0)}–${artifact.normalization.wind_speed_max.toFixed(0)} km/h). Treat this city ranking as highly uncertain; it is not a health or travel recommendation.`
      : '';
    }
    const pefAdvice = document.getElementById('pef-advice') ||
      document.getElementById('pef-advice-alt');
    if (pefAdvice) {
      pefAdvice.hidden = false;
      pefAdvice.textContent = 'A modeled peak-flow change is not a prediction of your response to travel. Follow your prescribed action plan. If breathing worsens, seek medical care rather than relying on a destination estimate.';
    }
    setOutput(['route-duration', 'route-duration-alt'], route ? `${Math.round(route.minutes)} min` : 'Unavailable');
    setOutput(['route-distance', 'route-distance-alt'], route ? `${(route.km * .621371).toFixed(1)} mi` : 'Unavailable');
    setOutput('pm25-trend', city.supportAdjusted ? 'Boundary adjusted' : 'Within training range');

    window.RouteActions.setDestination(origin, city, route);
    if (routeStatus) routeStatus.hidden = true;
    if (routeResult) routeResult.hidden = false;
    routeCompleted = true;
    if (routeResult) {
      routeResult.dataset.currentPef = String(currentPEF);
      routeResult.dataset.personalBest = String(personalBest);
    }
  }

  personalBestInput.addEventListener('input', () => {
    ++routeRequest; routing = false; findRouteButton.textContent = 'Compare nearby cities';
    routeCompleted = false;
    updateButtonState();
  });
  currentPEFInput.addEventListener('input', () => {
    ++routeRequest; routing = false; findRouteButton.textContent = 'Compare nearby cities';
    routeCompleted = false;
    updateButtonState();
  });

  async function compareCities(scroll = true) {
    if (refreshing || routing) return;
    const personalBest = validPositiveInput(personalBestInput);
    const currentPEF = validPositiveInput(currentPEFInput);
    if (!personalBest || !currentPEF || startingPM25 == null || startingWindSpeed == null) {
      updateButtonState();
      return;
    }

    play_audio(currentPEF, personalBest);

    if (currentPEF < personalBest * 0.5) {
      // PEF below 50% of personal best: collapse town recommendations and
      // show an emergency warning box instead of any travel advice.
      routeCompleted = false;
      bestDestination = null;
      routeResult.hidden = true;
      routeStatus.hidden = true;
      const warning = document.getElementById('pef-health-warning');
      if (warning) {
        warning.hidden = false;
        const warningText = warning.querySelector('.warning-text');
        if (warningText) warningText.textContent = 'Do NOT drive to another location now. Call 911 immediately and go to the nearest emergency room.';
      }
      findRouteButton.textContent = 'Compare nearby cities';
      findRouteButton.disabled = refreshing || !validPositiveInput(personalBestInput) || !validPositiveInput(currentPEFInput);
      return;
    }
    if (currentPEF > personalBest * 0.8) {
      const message = 'Your peak flow is >80% of your personal best. If you are currently experiencing symptoms, consult with your physician.';
      if (pefWarning) pefWarning.hidden = true;
      routeResult.hidden = true;
      routeStatus.hidden = false;
      routeStatus.textContent = message;
      routeCompleted = false;
      bestDestination = null;
      findRouteButton.textContent = 'Compare nearby cities';
      findRouteButton.disabled = refreshing || !validPositiveInput(personalBestInput) || !validPositiveInput(currentPEFInput);
      return;
    }
    if (pefWarning) pefWarning.hidden = true;
    const rankedCandidates = Model.rankCities(
      artifact, liveCities, currentPEF, personalBest, startingPM25, startingWindSpeed
    );
    const candidates = rankedCandidates
      .map((city) => ({ ...city, dist: distanceFromOrigin(city) }))
      .filter((city) => city.dist > 1)
      .sort((a, b) => Number(a.pm25) - Number(b.pm25) || a.dist - b.dist || a.gap - b.gap);
    if (!candidates.length) {
      const hasComparableCandidate = liveCities.some((city) =>
        city.pm25 != null && Number.isFinite(Number(city.pm25)) &&
        city.windSpeed != null && Number.isFinite(Number(city.windSpeed)) &&
        Number(city.pm25) < startingPM25 && distanceFromOrigin(city) > 1
      );
      if (hasComparableCandidate) {
        setRouteMessage('Nearby cleaner PM2.5 cities exist, but the model could not produce a finite PEF estimate. No destination is recommended.');
      } else {
        setRouteMessage('No nearby city has both PM2.5 and wind readings below the starting PM2.5. The app will not suggest a destination with worse air.');
      }
      return;
    }

    const best = candidates[0];
    bestDestination = best;
    const request = ++routeRequest;
    routing = true;
    findRouteButton.disabled = true;
    findRouteButton.textContent = 'Finding driving route…';
    // Show the scenario comparison immediately; a slow router must not hide it.
    showBestMatch(best, personalBest, currentPEF, personalBest * 0.8, null);
    routeStatus.hidden = false;
    routeStatus.textContent = `Comparison ready. Checking driving time from ${origin.label} to ${best.name}...`;
    try {
      const departure = Date.now();
      const route = await API.fastestRoute(origin, best);
      if (request !== routeRequest) return;
      showBestMatch(best, personalBest, currentPEF, personalBest * 0.8, route);
      await window.RouteActions.checkArrival(best, route, departure);
    } catch (error) {
      if (request !== routeRequest) return;
      showBestMatch(best, personalBest, currentPEF, personalBest * 0.8, null);
      routeStatus.hidden = false;
      routeStatus.textContent = 'Comparison complete. Driving time is unavailable; directions require an internet connection. Check official travel alerts.';
    } finally {
      if (request === routeRequest) {
        routing = false;
        findRouteButton.textContent = 'Compare nearby cities';
        findRouteButton.disabled = refreshing || !validPositiveInput(personalBestInput) || !validPositiveInput(currentPEFInput);
        if (scroll) document.querySelector('.route-output').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }
  findRouteButton.addEventListener('click', () => compareCities());

  const chooseTown = document.getElementById('choose-town');
  if (chooseTown) {
    chooseTown.addEventListener('click', () => {
      if (bestDestination && origin) {
        const link = API.googleMapsLink(bestDestination, origin);
        window.open(link, '_blank', 'noopener,noreferrer');
      } else {
        setRouteMessage('Compare nearby cities first to get a recommended destination.');
      }
    });
  }

  const chooseLibrary = document.getElementById('choose-library');
  if (chooseLibrary) {
    chooseLibrary.addEventListener('click', async () => {
      chooseLibrary.disabled = true;
      chooseLibrary.setAttribute('aria-expanded', 'true');
      const panel = document.getElementById('library-panel');
      if (panel) panel.hidden = false;
      try {
        await window.RouteActions.searchAndOpenLibraryDirections();
      } catch (error) {
        setRouteMessage('Library search unavailable. Check your connection and try again.');
      } finally {
        chooseLibrary.disabled = false;
      }
    });
  }

  refreshLiveData();
  window.addEventListener('aqi:modechange', refreshLiveData);
  document.getElementById('refresh-conditions').addEventListener('click', refreshLiveData);
  window.GuardianSpeech = () => 'Educational route comparison, not medical or travel advice. ' +
    (personalBestInput.value ? 'Personal best ' + personalBestInput.value + ' liters per minute. ' : '') +
    (currentPEFInput.value ? 'Current peak flow ' + currentPEFInput.value + ' liters per minute. ' : '') +
    dataStatus.textContent + '. Starting location: ' + origin.label + '. ' +
    (routeResult.hidden ? routeStatus.textContent : routeResult.innerText + (routeStatus.hidden ? '' : '. ' + routeStatus.textContent)) + '. ' + document.querySelector('.next-steps').innerText;
  window.addEventListener('storage', e => { if (e.key === 'aqi-house' || e.key === null) refreshLiveData(); });
  window.setInterval(refreshLiveData, 15 * 60 * 1000);
})();
