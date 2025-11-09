window.Util = (() => {
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const lerp = (start, end, t) => start + (end - start) * t;

  const lerpWithDeadband = (current, target, smoothing, deadband) => {
    const delta = target - current;
    if (Math.abs(delta) <= deadband) {
      return target;
    }
    return current + delta * smoothing;
  };

  const randRange = (min, max) => Math.random() * (max - min) + min;

  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  const parseFlags = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      debug: params.get("debug") === "1",
      easy: params.get("easy") === "1",
      hard: params.get("hard") === "1",
    };
  };

  const isLaptopEnvironment = () => {
    const touchPoints = navigator.maxTouchPoints || 0;
    const pointerCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    return touchPoints === 0 && !pointerCoarse && window.innerWidth >= 768;
  };

  return {
    clamp,
    lerp,
    lerpWithDeadband,
    randRange,
    now,
    parseFlags,
    isLaptopEnvironment,
  };
})();
