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
  const inputError = document.getElementById('input-error');
  if (modelStatus) modelStatus.textContent = 'Loading trained tanh model…';
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

  const training = artifact.training;
  const tuning = training.hyperparameter_selection;
  if (modelStatus) {
    modelStatus.textContent = `Tuned tanh · ${tuning.candidate_count} configs · ${Math.round(tuning.selected.dropout_rate * 100)}% dropout · ${training.training_subjects}/${training.testing_subjects} synthetic subjects train/test`;
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
    return input.value.trim() && Number.isFinite(value) && value > 0 ? value : null;
  }

  function setRouteMessage(message) {
    routeCompleted = false;
    routeStatus.textContent = message;
    routeStatus.hidden = false;
    routeResult.hidden = true;
  }

  function updateButtonState() {
    const bothInputsValid = validPositiveInput(personalBestInput) !== null &&
      validPositiveInput(currentPEFInput) !== null;
    const originConditionsAvailable = Number.isFinite(startingPM25) && Number.isFinite(startingWindSpeed);
    findRouteButton.disabled = !bothInputsValid || !liveCities.length ||
      !originConditionsAvailable || refreshing;
    if (routeCompleted && bothInputsValid && originConditionsAvailable && !refreshing) {
      return;
    }
    if (!bothInputsValid) {
      inputError.textContent = personalBestInput.value || currentPEFInput.value
        ? 'Enter positive values for both PEF measurements.'
        : '';
      inputError.hidden = !inputError.textContent;
      setRouteMessage('Enter the personal-best and current PEF measurements to compare routes.');
    } else {
      inputError.textContent = '';
      inputError.hidden = true;
      if (!liveCities.length) {
        setRouteMessage('Live city PM2.5 readings are not available yet. Try again shortly.');
      } else if (startingPM25 === null || startingWindSpeed === null) {
        setRouteMessage('Nearby readings loaded, but current PM2.5 or wind speed at the starting location is unavailable.');
      } else if (startingPM25 < artifact.normalization.pm25_min ||
          startingPM25 > artifact.normalization.pm25_max ||
          startingWindSpeed < artifact.normalization.wind_speed_min ||
          startingWindSpeed > artifact.normalization.wind_speed_max) {
        setRouteMessage(`Ready to compare cities. An origin input is outside model support; inference will saturate at the boundary (PM2.5 ${artifact.normalization.pm25_min.toFixed(1)}–${artifact.normalization.pm25_max.toFixed(1)} μg/m³; wind ${artifact.normalization.wind_speed_min.toFixed(0)}–${artifact.normalization.wind_speed_max.toFixed(0)} km/h), not extrapolate.`);
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
        return { lat: Number(saved.lat), lon: Number(saved.lon), label: saved.label || 'Saved home location' };
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
    if (refreshing) return;
    refreshing = true;
    dataStatus.textContent = 'Refreshing Open-Meteo readings…';
    findRouteButton.disabled = true;
    try {
      liveCities = await API.fetchTownAQIs(towns);
      origin = getSavedOrigin();
      const savedHome = origin.label !== 'Tri-Cities, WA (default origin)';
      if (savedHome) {
        try {
          const point = await API.fetchPointAQI(origin.lat, origin.lon);
          startingPM25 = point.pm25;
          startingWindSpeed = point.windSpeed;
        } catch (error) {
          startingPM25 = null;
          startingWindSpeed = null;
        }
        if (startingWindSpeed == null) {
          try {
            const wind = await API.fetchPointWindSpeed(origin.lat, origin.lon);
            startingWindSpeed = wind.windSpeed;
          } catch (error) {
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
      dataStatus.textContent = `Live · ${available} PM2.5 + wind pairs`;
      renderCityList();
      updateButtonState();
    } catch (error) {
      dataStatus.textContent = 'Live data unavailable';
      setRouteMessage(`Could not load Open-Meteo city readings. ${error.message || 'Check the connection and try again.'}`);
    } finally {
      refreshing = false;
      updateButtonState();
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
      ? `Boundary-saturated estimate: at least one live PM2.5/wind value was outside the synthetic model range. The model used the nearest boundary value (PM2.5 ${artifact.normalization.pm25_min.toFixed(1)}–${artifact.normalization.pm25_max.toFixed(1)} μg/m³; wind ${artifact.normalization.wind_speed_min.toFixed(0)}–${artifact.normalization.wind_speed_max.toFixed(0)} km/h). Treat this city ranking as highly uncertain; it is not a health or travel recommendation.`
      : '';
    }
    setOutput(['route-duration', 'route-duration-alt'], `${Math.round(route.minutes)} min`);
    setOutput(['route-distance', 'route-distance-alt'], `${route.km.toFixed(1)} km`);
    setOutput('pm25-trend', city.supportAdjusted ? 'Boundary adjusted' : 'Within training range');

    const directions = document.getElementById('map-route') || document.getElementById('map-route-alt');
    if (directions) directions.href = API.googleMapsLink(origin, city);
    if (routeStatus) routeStatus.hidden = true;
    if (routeResult) routeResult.hidden = false;
    routeCompleted = true;
    if (routeResult) {
      routeResult.dataset.currentPef = String(currentPEF);
      routeResult.dataset.personalBest = String(personalBest);
    }
  }

  personalBestInput.addEventListener('input', () => {
    routeCompleted = false;
    updateButtonState();
  });
  currentPEFInput.addEventListener('input', () => {
    routeCompleted = false;
    updateButtonState();
  });

  findRouteButton.addEventListener('click', async () => {
    const personalBest = validPositiveInput(personalBestInput);
    const currentPEF = validPositiveInput(currentPEFInput);
    if (!personalBest || !currentPEF || startingPM25 == null || startingWindSpeed == null) {
      updateButtonState();
      return;
    }

    const rankedCandidates = Model.rankCities(
      artifact, liveCities, currentPEF, personalBest, startingPM25, startingWindSpeed
    );
    const candidates = rankedCandidates
      .map((city) => ({ ...city, dist: distanceFromOrigin(city) }))
      .filter((city) => city.dist > 1)
      .sort((a, b) => a.gap - b.gap || a.dist - b.dist || a.pm25 - b.pm25);
    if (!candidates.length) {
      const hasComparableCandidate = liveCities.some((city) =>
        city.pm25 != null && Number.isFinite(Number(city.pm25)) &&
        city.windSpeed != null && Number.isFinite(Number(city.windSpeed)) &&
        Number(city.pm25) <= startingPM25 && distanceFromOrigin(city) > 1
      );
      if (hasComparableCandidate) {
        setRouteMessage('Nearby cleaner/equal-PM2.5 cities exist, but the model could not produce a finite PEF estimate. No destination is recommended.');
      } else {
        setRouteMessage('No nearby city has both live PM2.5 and wind readings at or below the starting PM2.5. The app will not suggest a destination with worse air.');
      }
      return;
    }

    const best = candidates[0];
    findRouteButton.disabled = true;
    findRouteButton.textContent = 'Finding driving route…';
    setRouteMessage(`Best modeled PM2.5 match: ${best.name}. Calculating driving route from ${origin.label}…`);
    try {
      const route = await API.fastestRoute(origin, best);
      showBestMatch(best, personalBest, currentPEF, personalBest * 0.8, route);
    } catch (error) {
      setRouteMessage(`The best modeled match is ${best.name} at ${Number(best.pm25).toFixed(1)} μg/m³, but the driving route service failed: ${error.message || 'unknown error'}.`);
    } finally {
      findRouteButton.textContent = 'Check live cities and find route';
      updateButtonState();
    }
  });

  refreshLiveData();
  window.setInterval(refreshLiveData, 15 * 60 * 1000);
})();
