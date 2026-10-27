/* Browser inference for weights exported by train_pef_model.py. */
(function () {
  'use strict';

  let artifactPromise;

  async function load() {
    if (!artifactPromise) {
      artifactPromise = fetch('./regression-model.json', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`Model weights request failed (${response.status}).`);
          return response.json();
        })
        .then((artifact) => {
          const architecture = artifact.architecture || {};
          const weights = artifact.weights || {};
          const hiddenCount = architecture.hidden;
            if (artifact.schema_version !== 1 || architecture.inputs !== 2 ||
              architecture.outputs !== 1 || architecture.hidden_activation !== 'tanh' ||
              architecture.output_activation !== 'tanh' || !Number.isInteger(hiddenCount) ||
              !Array.isArray(weights.hidden_weights) || weights.hidden_weights.length !== hiddenCount ||
              weights.hidden_weights.some((row) => !Array.isArray(row) || row.length !== 2) ||
              !Array.isArray(weights.hidden_biases) || weights.hidden_biases.length !== hiddenCount ||
              !Array.isArray(weights.output_weights) || weights.output_weights.length !== hiddenCount) {
            throw new Error('The exported neural-network weights have an unsupported format.');
          }
          return Object.freeze(artifact);
        })
        .catch((error) => {
          artifactPromise = null;
          throw error;
        });
    }
    return artifactPromise;
  }

  function predictPEF(artifact, pm25, windSpeedKmh) {
    const value = Number(pm25);
    const wind = Number(windSpeedKmh);
    const scale = artifact.normalization;
    if (!Number.isFinite(value) || !Number.isFinite(wind)) {
      return null;
    }
    // Saturate at the trained boundary rather than extrapolating beyond the synthetic panel.
    const boundedPM25 = Math.max(scale.pm25_min, Math.min(scale.pm25_max, value));
    const boundedWind = Math.max(scale.wind_speed_min, Math.min(scale.wind_speed_max, wind));
    const normalizedPM25 = 2 * (boundedPM25 - scale.pm25_min) /
      (scale.pm25_max - scale.pm25_min) - 1;
    const normalizedWind = 2 * (boundedWind - scale.wind_speed_min) /
      (scale.wind_speed_max - scale.wind_speed_min) - 1;
    const weights = artifact.weights;
    const hidden = weights.hidden_weights.map((connection, index) =>
      Math.tanh(connection[0] * normalizedPM25 + connection[1] * normalizedWind +
        weights.hidden_biases[index])
    );
    const outputInput = hidden.reduce((sum, activation, index) =>
      sum + weights.output_weights[index] * activation, weights.output_bias
    );
    const normalizedOutput = Math.tanh(outputInput);
    return scale.pef_min + (normalizedOutput + 1) *
      (scale.pef_max - scale.pef_min) / 2;
  }

  function estimatePEFChange(artifact, currentPEF, startingPM25, startingWindSpeed,
    destinationPM25, destinationWindSpeed) {
    const current = Number(currentPEF);
    const starting = Number(startingPM25);
    const destination = Number(destinationPM25);
    if (![current, starting, destination].every(Number.isFinite)) return null;
    
    const pm25Min = artifact.normalization.pm25_min;
    const pm25Max = artifact.normalization.pm25_max;
    const belowTrainingRange = starting < pm25Min;
    
    const startEstimate = predictPEF(artifact, starting, startingWindSpeed);
    const destinationEstimate = predictPEF(artifact, destination, destinationWindSpeed);
    if (startEstimate === null || destinationEstimate === null) return null;
    
    // Handle below-training-range starting PM2.5
    if (belowTrainingRange) {
      const clampedStart = Math.max(pm25Min, starting);
      const clampedDestination = Math.max(pm25Min, destination);
      const modelStart = predictPEF(artifact, clampedStart, startingWindSpeed);
      const modelDestination = predictPEF(artifact, clampedDestination, destinationWindSpeed);
      if (modelStart === null || modelDestination === null) return null;
      return current + (modelDestination - modelStart);
    }
    
    return current + destinationEstimate - startEstimate;
  }

  function rankCities(artifact, cities, currentPEF, personalBestPEF, startingPM25,
    startingWindSpeed) {
    const current = Number(currentPEF);
    const personalBest = Number(personalBestPEF);
    const start = Number(startingPM25);
    const threshold = personalBest * 0.8;
    const startWind = Number(startingWindSpeed);
    if (![current, personalBest, start, startWind].every(Number.isFinite) || threshold <= 0) return [];

    return cities
      .filter((city) => city.pm25 != null && city.windSpeed != null && Number.isFinite(Number(city.windSpeed)) && Number.isFinite(Number(city.pm25)) && Number(city.pm25) < start)
      .map((city) => {
        const modeledPEF = estimatePEFChange(
          artifact, current, start, startWind, city.pm25, city.windSpeed
        );
        if (modeledPEF === null) return null;
        return {
          ...city,
          modeledPEF,
          threshold,
          gap: Math.abs(modeledPEF - threshold),
          supportAdjusted: Number(start) < artifact.normalization.pm25_min ||
            Number(start) > artifact.normalization.pm25_max ||
            Number(startWind) < artifact.normalization.wind_speed_min ||
            Number(startWind) > artifact.normalization.wind_speed_max ||
            Number(city.pm25) < artifact.normalization.pm25_min ||
            Number(city.pm25) > artifact.normalization.pm25_max ||
            Number(city.windSpeed) < artifact.normalization.wind_speed_min ||
            Number(city.windSpeed) > artifact.normalization.wind_speed_max
        };
      })
      .filter(Boolean)
      // Rank by air-quality improvement first: a city with cleaner air (lower PM2.5)
      // always ranks above one with worse air, even if the worse-air city's modeled
      // PEF happens to land closer to the threshold.  Among cities with similar
      // PM2.5, prefer the one whose modeled PEF is closest to the threshold.
      .sort((a, b) => Number(a.pm25) - Number(b.pm25) || a.gap - b.gap);
  }

  window.PEFNeuralModel = Object.freeze({ load, predictPEF, estimatePEFChange, rankCities });
})();

function play_audio(CurrentPEF, PersonalBestPEF) {
  if (CurrentPEF < PersonalBestPEF * 0.8) {
    const audio = new Audio('WhatsApp Audio 2026-10-24 at 6.02.56 PM.mp3');
    audio.play().catch(() => {});
  }
}
window.play_audio = play_audio;

