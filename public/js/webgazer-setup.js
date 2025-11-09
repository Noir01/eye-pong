window.Gaze = (() => {
  const { clamp, now } = window.Util;

  const state = {
    lastSample: null,
    calibrationPairsX: [],
    calibrationPairsY: [],
    mappingX: null,
    mappingY: null,
    ready: false,
    filteredSample: null,
  };

  const STALE_MS = 300;
  const DEBUG_SAMPLE_INTERVAL = 800;
  const DEBUG_STALE_INTERVAL = 1500;
  const FILTER_ALPHA = 0.25;
  let debugMode = false;
  let lastSampleLog = 0;
  let lastStaleLog = 0;

  const logSampleUpdate = (ts) => {
    if (!debugMode || ts - lastSampleLog < DEBUG_SAMPLE_INTERVAL || !state.lastSample) {
      return;
    }
    lastSampleLog = ts;
    console.debug("[Gaze] sample update", {
      x: Math.round(state.lastSample.x),
      y: Math.round(state.lastSample.y),
      ts: Math.round(ts),
    });
  };

  const logStaleSample = (age) => {
    const ts = now();
    if (!debugMode || ts - lastStaleLog < DEBUG_STALE_INTERVAL) {
      return;
    }
    lastStaleLog = ts;
    console.debug(`[Gaze] ignoring stale sample (${Math.round(age)}ms old)`);
  };

  const handleGaze = (data) => {
    if (!data) {
      state.lastSample = null;
      state.filteredSample = null;
      return;
    }
    const ts = now();
    state.lastSample = {
      x: data.x,
      y: data.y,
      ts,
    };
    const prev = state.filteredSample || state.lastSample;
    state.filteredSample = {
      x: prev ? prev.x + (data.x - prev.x) * FILTER_ALPHA : data.x,
      y: prev ? prev.y + (data.y - prev.y) * FILTER_ALPHA : data.y,
      ts,
    };
    logSampleUpdate(ts);
  };

  const ensureStarted = async () => {
    if (state.ready) return;
    if (!window.webgazer) {
      throw new Error("WebGazer failed to load.");
    }
    await window.webgazer.setGazeListener(handleGaze).begin();
    window.webgazer.showVideo(false).showFaceOverlay(false).showPredictionPoints(false);
    state.ready = true;
  };

  const stop = async () => {
    if (window.webgazer && state.ready) {
      await window.webgazer.end();
    }
    state.ready = false;
    state.lastSample = null;
    state.filteredSample = null;
  };

  const pause = () => {
    if (window.webgazer && state.ready) {
      window.webgazer.pause();
    }
  };

  const resume = () => {
    if (window.webgazer && state.ready) {
      window.webgazer.resume();
    }
  };

  const resetCalibration = () => {
    state.calibrationPairsX = [];
    state.calibrationPairsY = [];
    state.mappingX = null;
    state.mappingY = null;
  };

  const addCalibrationSample = (raw, target) => {
    state.calibrationPairsX.push({ page: raw.x, canvas: target.canvasX });
    state.calibrationPairsY.push({ page: raw.y, canvas: target.canvasY });
  };

  const buildMapping = (pairs) => {
    if (pairs.length < 2) {
      return null;
    }
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (const { page, canvas } of pairs) {
      sumX += page;
      sumY += canvas;
      sumXY += page * canvas;
      sumXX += page * page;
    }
    const n = pairs.length;
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) {
      return null;
    }
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  };

  const commitCalibration = () => {
    const mapX = buildMapping(state.calibrationPairsX);
    const mapY = buildMapping(state.calibrationPairsY);
    if (!mapX || !mapY) {
      state.mappingX = null;
      state.mappingY = null;
      return false;
    }
    state.mappingX = mapX;
    state.mappingY = mapY;
    return true;
  };

  const getCanvasY = (bounds, logicalHeight) => {
    const sample = state.filteredSample || state.lastSample;
    if (!sample) return null;
    const age = now() - sample.ts;
    if (age > STALE_MS) {
      logStaleSample(age);
      return null;
    }
    if (state.mappingY) {
      const y = state.mappingY.slope * sample.y + state.mappingY.intercept;
      return clamp(y, 0, logicalHeight);
    }
    if (!bounds) return null;
    const ratio = (sample.y - bounds.top) / bounds.height;
    return clamp(ratio * logicalHeight, 0, logicalHeight);
  };

  const getCanvasX = (bounds, logicalWidth) => {
    const sample = state.filteredSample || state.lastSample;
    if (!sample) return null;
    const age = now() - sample.ts;
    if (age > STALE_MS) {
      logStaleSample(age);
      return null;
    }
    if (state.mappingX) {
      const x = state.mappingX.slope * sample.x + state.mappingX.intercept;
      return clamp(x, 0, logicalWidth);
    }
    if (!bounds) return null;
    const ratio = (sample.x - bounds.left) / bounds.width;
    return clamp(ratio * logicalWidth, 0, logicalWidth);
  };

  const isStale = (limit = 300) => {
    if (!state.lastSample) return true;
    return now() - state.lastSample.ts > limit;
  };

  const getCalibrationCount = () => Math.min(state.calibrationPairsX.length, state.calibrationPairsY.length);

  const getLastSample = () => {
    if (!state.lastSample) return null;
    return {
      ...state.lastSample,
      smoothed: state.filteredSample ? { ...state.filteredSample } : null,
    };
  };

  const setDebugMode = (enabled) => {
    debugMode = Boolean(enabled);
  };

  return {
    ensureStarted,
    stop,
    pause,
    resume,
    resetCalibration,
    addCalibrationSample,
    commitCalibration,
    getCanvasY,
    getCanvasX,
    isStale,
    getCalibrationCount,
    getLastSample,
    setDebugMode,
  };
})();
