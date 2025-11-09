(() => {
  const flags = window.Util.parseFlags();
  const CONFIG = {
    ARENA_W: 900,
    ARENA_H: 600,
    PADDLE_W: 120,
    PADDLE_H: 18,
    BALL_SIZE: 12,
    BALL_SPEED_INIT: 6,
    BALL_SPEED_MAX: 12,
    BALL_ACCEL: 0.05,
    SCORE_WIN: 5,
    EYE_SMOOTHING: 0.15,
    EYE_DEADBAND: 6,
    PADDLE_SPEED_CPU: 7,
  };

  if (flags.easy) {
    CONFIG.PADDLE_SPEED_CPU = 5;
  } else if (flags.hard) {
    CONFIG.PADDLE_SPEED_CPU = 9;
  }

  const elements = {
    deviceGate: document.getElementById("deviceGate"),
    splash: document.getElementById("splashPanel"),
    startBtn: document.getElementById("startBtn"),
    statusPanel: document.getElementById("statusPanel"),
    statusText: document.getElementById("statusText"),
    retryBtn: document.getElementById("retryBtn"),
    calibrationPanel: document.getElementById("calibrationPanel"),
    calibrationBoard: document.getElementById("calibrationBoard"),
    calibrationProgress: document.getElementById("calibrationProgress"),
    calibrationDoneBtn: document.getElementById("calibrationDoneBtn"),
    calibrationResetBtn: document.getElementById("calibrationResetBtn"),
    gameWrapper: document.getElementById("gameWrapper"),
    scoreboard: document.getElementById("scoreboard"),
    pauseBtn: document.getElementById("pauseBtn"),
    resumeBtn: document.getElementById("resumeBtn"),
    recalibrateBtn: document.getElementById("recalibrateBtn"),
    quitBtn: document.getElementById("quitBtn"),
    cameraOffBtn: document.getElementById("cameraOffBtn"),
    overlay: document.getElementById("overlay"),
    overlayText: document.getElementById("overlayText"),
    resumeOverlayBtn: document.getElementById("resumeOverlayBtn"),
    playAgainBtn: document.getElementById("playAgainBtn"),
    trackingIndicator: document.getElementById("trackingIndicator"),
    debugHint: document.getElementById("debugHint"),
    gameCanvas: document.getElementById("gameCanvas"),
  };

  const ctx = elements.gameCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const sections = [elements.splash, elements.statusPanel, elements.calibrationPanel, elements.gameWrapper];

  const paddles = {
    cpu: {
      x: CONFIG.ARENA_W / 2,
      y: 50,
      targetX: CONFIG.ARENA_W / 2,
      side: "top",
    },
    human: {
      x: CONFIG.ARENA_W / 2,
      y: CONFIG.ARENA_H - 50,
      targetX: CONFIG.ARENA_W / 2,
      side: "bottom",
    },
  };

  const ball = window.Physics.createBall(CONFIG);

  const state = {
    phase: "SPLASH",
    running: false,
    freezeUntil: null,
    serveDirection: 1,
    scores: { cpu: 0, human: 0 },
    calibrationContext: "initial",
    cameraActive: false,
    debug: flags.debug,
    lastGazeTs: window.Util.now(),
  };

  if (window.Gaze && typeof window.Gaze.setDebugMode === "function") {
    window.Gaze.setDebugMode(state.debug);
  }

  const CAL_POINTS = [
    { x: 0.08, y: 0.12 },
    { x: 0.35, y: 0.12 },
    { x: 0.65, y: 0.12 },
    { x: 0.92, y: 0.12 },
    { x: 0.08, y: 0.38 },
    { x: 0.35, y: 0.38 },
    { x: 0.65, y: 0.38 },
    { x: 0.92, y: 0.38 },
    { x: 0.08, y: 0.68 },
    { x: 0.35, y: 0.68 },
    { x: 0.65, y: 0.68 },
    { x: 0.92, y: 0.68 },
    { x: 0.08, y: 0.9 },
    { x: 0.35, y: 0.9 },
    { x: 0.65, y: 0.9 },
    { x: 0.92, y: 0.9 },
  ];

  const calibrationDots = [];
  const COMPLETIONS_REQUIRED = CAL_POINTS.length;

  let rafId = null;
  let lastFrame = 0;
  let canvasBounds = elements.gameCanvas.getBoundingClientRect();

  const debugKeys = { left: false, right: false };

  const init = () => {
    setupDeviceGate();
    bindEvents();
    buildCalibrationDots();
    updateScoreboard();
    if (state.debug) {
      elements.debugHint.hidden = false;
      updateDebugReadout(null);
    }
    showSection(elements.splash);
  };

  const setupDeviceGate = () => {
    if (window.Util.isLaptopEnvironment()) {
      elements.deviceGate.classList.add("hidden");
      elements.startBtn.disabled = false;
    } else {
      elements.deviceGate.classList.remove("hidden");
      elements.startBtn.disabled = true;
      elements.startBtn.textContent = "Laptop required";
    }
  };

  const bindEvents = () => {
    elements.startBtn.addEventListener("click", () => beginPermissionFlow("initial"));
    elements.retryBtn.addEventListener("click", () => beginPermissionFlow("initial"));
    elements.calibrationDoneBtn.addEventListener("click", onCalibrationFinished);
    elements.calibrationResetBtn.addEventListener("click", resetCalibrationUI);
    elements.pauseBtn.addEventListener("click", () => pauseGame("Paused"));
    elements.resumeBtn.addEventListener("click", resumeGame);
    elements.resumeOverlayBtn.addEventListener("click", resumeGame);
    elements.playAgainBtn.addEventListener("click", resetMatch);
    elements.recalibrateBtn.addEventListener("click", () => {
      if (state.phase === "PLAYING") {
        pauseGame("Recalibrating…");
      } else {
        stopLoop();
      }
      beginPermissionFlow("recalibrate");
    });
    elements.quitBtn.addEventListener("click", quitToSplash);
    elements.cameraOffBtn.addEventListener("click", turnCameraOff);

    window.addEventListener("resize", () => {
      canvasBounds = elements.gameCanvas.getBoundingClientRect();
    });

    window.addEventListener("keydown", (ev) => {
      if (!state.debug) return;
      if (ev.key === "ArrowLeft") {
        debugKeys.left = true;
        ev.preventDefault();
      } else if (ev.key === "ArrowRight") {
        debugKeys.right = true;
        ev.preventDefault();
      }
    });
    window.addEventListener("keyup", (ev) => {
      if (!state.debug) return;
      if (ev.key === "ArrowLeft") {
        debugKeys.left = false;
      } else if (ev.key === "ArrowRight") {
        debugKeys.right = false;
      }
    });
  };

  const showSection = (target) => {
    sections.forEach((section) => {
      if (!section) return;
      section.classList.toggle("hidden", section !== target);
    });
    if (target === elements.gameWrapper) {
      canvasBounds = elements.gameCanvas.getBoundingClientRect();
    }
  };

  const setStatus = (text, isError = false) => {
    elements.statusText.textContent = text;
    elements.statusText.style.color = isError ? "var(--danger)" : "";
  };

  const beginPermissionFlow = async (context) => {
    if (elements.startBtn.disabled && context === "initial") {
      return;
    }
    state.calibrationContext = context;
    showSection(elements.statusPanel);
    setStatus("Requesting webcam access…");
    elements.retryBtn.classList.add("hidden");
    try {
      const initPromise = window.Gaze.ensureStarted();
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for WebGazer.")), 3500));
      await Promise.race([initPromise, timeout]);
      state.cameraActive = true;
      elements.cameraOffBtn.hidden = false;
      setStatus("Camera ready. Let's calibrate.");
      await new Promise((resolve) => setTimeout(resolve, 500));
      startCalibration();
    } catch (err) {
      if (state.debug) {
        setStatus(`Webcam unavailable. Debug mode active. (${err.message || err})`, true);
        if (context === "initial") {
          prepareMatch();
        } else {
          resumeAfterCalibration();
        }
        return;
      }
      setStatus(`Need webcam access. ${err.message || err} (add ?debug=1 for keyboard fallback)`, true);
      elements.retryBtn.classList.remove("hidden");
    }
  };

  const startCalibration = () => {
    resetCalibrationUI();
    showSection(elements.calibrationPanel);
  };

  const resetCalibrationUI = () => {
    window.Gaze.resetCalibration();
    calibrationDots.forEach((dot) => {
      dot.element.classList.remove("completed", "pending");
      dot.element.disabled = false;
    });
    elements.calibrationDoneBtn.disabled = true;
    elements.calibrationProgress.textContent = `0 / ${COMPLETIONS_REQUIRED} completed`;
  };

  const buildCalibrationDots = () => {
    elements.calibrationBoard.innerHTML = "";
    calibrationDots.length = 0;
    CAL_POINTS.forEach((pt, index) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "calibration-dot";
      el.textContent = String(index + 1);
      el.style.left = `${pt.x * 100}%`;
      el.style.top = `${pt.y * 100}%`;
      const entry = {
        element: el,
        index,
        canvasX: pt.x * CONFIG.ARENA_W,
        canvasY: pt.y * CONFIG.ARENA_H,
      };
      el.addEventListener("click", () => collectCalibration(entry));
      calibrationDots.push(entry);
      elements.calibrationBoard.appendChild(el);
    });
  };

  const collectCalibration = async (entry) => {
    if (entry.element.disabled) return;
    entry.element.disabled = true;
    entry.element.classList.add("pending");
    const success = await gatherSamples(entry);
    entry.element.classList.remove("pending");
    if (success) {
      entry.element.classList.add("completed");
      updateCalibrationProgress();
    } else {
      entry.element.disabled = false;
    }
  };

  const gatherSamples = async (target) => {
    const SAMPLES = 15;
    const MAX_ATTEMPTS = SAMPLES * 4;
    let collected = 0;
    let attempts = 0;

    return new Promise((resolve) => {
      const tick = () => {
        attempts += 1;
        const raw = window.Gaze.getLastSample();
        if (raw) {
          window.Gaze.addCalibrationSample(raw, target);
          collected += 1;
        }
        if (collected >= SAMPLES) {
          resolve(true);
          return;
        }
        if (attempts >= MAX_ATTEMPTS) {
          resolve(collected > 0);
          return;
        }
        setTimeout(tick, 30);
      };
      tick();
    });
  };

  const updateCalibrationProgress = () => {
    const completed = calibrationDots.filter((dot) => dot.element.classList.contains("completed")).length;
    elements.calibrationProgress.textContent = `${completed} / ${COMPLETIONS_REQUIRED} completed`;
    if (completed >= COMPLETIONS_REQUIRED) {
      elements.calibrationDoneBtn.disabled = false;
    }
  };

  const onCalibrationFinished = () => {
    const ok = window.Gaze.commitCalibration();
    if (!ok) {
      elements.calibrationProgress.textContent = "Need more samples. Try again.";
      return;
    }
    if (state.calibrationContext === "initial") {
      prepareMatch();
    } else {
      resumeAfterCalibration();
    }
  };

  const prepareMatch = () => {
    resetGameObjects();
    state.scores.cpu = 0;
    state.scores.human = 0;
    updateScoreboard();
    showSection(elements.gameWrapper);
    state.phase = "COUNTDOWN";
    prepareServe(-1);
    startLoop();
  };

  const resumeAfterCalibration = () => {
    showSection(elements.gameWrapper);
    if (state.phase === "PAUSED") {
      hideOverlay();
      togglePauseButtons(false);
    }
    state.phase = "COUNTDOWN";
    prepareServe(state.serveDirection);
    startLoop();
  };

  const resetGameObjects = () => {
    paddles.human.x = CONFIG.ARENA_W / 2;
    paddles.human.targetX = CONFIG.ARENA_W / 2;
    paddles.human.y = CONFIG.ARENA_H - 50;
    paddles.cpu.x = CONFIG.ARENA_W / 2;
    paddles.cpu.targetX = CONFIG.ARENA_W / 2;
    paddles.cpu.y = 50;
    window.Physics.resetBall(ball, CONFIG);
  };

  const updateScoreboard = () => {
    elements.scoreboard.textContent = `CPU ↑ ${state.scores.cpu} — ${state.scores.human} YOU ↓`;
  };

  const togglePauseButtons = (isPaused) => {
    elements.pauseBtn.classList.toggle("hidden", isPaused);
    elements.resumeBtn.classList.toggle("hidden", !isPaused);
  };

  const prepareServe = (direction) => {
    window.Physics.resetBall(ball, CONFIG);
    state.serveDirection = direction;
    state.freezeUntil = window.Util.now() + 1000;
  };

  const startLoop = () => {
    if (state.running) return;
    state.running = true;
    state.phase = "PLAYING";
    state.lastGazeTs = window.Util.now();
    lastFrame = 0;
    rafId = requestAnimationFrame(frame);
  };

  const stopLoop = () => {
    state.running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const frame = (timestamp) => {
    if (!state.running) return;
    if (!lastFrame) {
      lastFrame = timestamp;
    }
    const dt = Math.min((timestamp - lastFrame) / (1000 / 60), 2);
    lastFrame = timestamp;

    if (state.freezeUntil) {
      if (timestamp >= state.freezeUntil && ball.vx === 0 && ball.vy === 0) {
        window.Physics.serveBall(ball, state.serveDirection, CONFIG);
        state.freezeUntil = null;
      }
    }

    updateHumanPaddle(dt);
    updateCpuPaddle(dt);
    window.Physics.updateBall(ball, paddles.human, paddles.cpu, CONFIG, dt, handleScore);
    const nowTs = window.Util.now();
    if (!state.freezeUntil && state.phase === "PLAYING" && state.cameraActive && nowTs - state.lastGazeTs > 2000) {
      pauseGame("Tracking lost. Recenter & Resume.");
    }

    draw();
    rafId = requestAnimationFrame(frame);
  };

  const updateHumanPaddle = (dt) => {
    const half = CONFIG.PADDLE_W / 2;
    let target = paddles.human.targetX;
    const gazeX = window.Gaze.getCanvasX(canvasBounds, CONFIG.ARENA_W);
    if (gazeX != null) {
      target = window.Util.clamp(gazeX, half, CONFIG.ARENA_W - half);
      state.lastGazeTs = window.Util.now();
    } else if (state.debug) {
      const speed = 9 * dt;
      if (debugKeys.left) target -= speed * 60;
      if (debugKeys.right) target += speed * 60;
      target = window.Util.clamp(target, half, CONFIG.ARENA_W - half);
    }
    paddles.human.targetX = target;
    paddles.human.x = window.Util.lerpWithDeadband(paddles.human.x, target, CONFIG.EYE_SMOOTHING, CONFIG.EYE_DEADBAND);
    paddles.human.x = window.Util.clamp(paddles.human.x, half, CONFIG.ARENA_W - half);
    toggleTrackingIndicator(window.Gaze.isStale());
    updateDebugReadout(gazeX);
  };

  const updateCpuPaddle = (dt) => {
    const half = CONFIG.PADDLE_W / 2;
    paddles.cpu.x = window.CpuAI.follow(paddles.cpu.x, ball.x, CONFIG.PADDLE_SPEED_CPU, dt);
    paddles.cpu.x = window.Util.clamp(paddles.cpu.x, half, CONFIG.ARENA_W - half);
  };

  const toggleTrackingIndicator = (show) => {
    const shouldShow = show && state.cameraActive && !elements.gameWrapper.classList.contains("hidden");
    elements.trackingIndicator.classList.toggle("hidden", !shouldShow);
  };

  const describeValue = (value) => (Number.isFinite(value) ? Math.round(value) : "—");

  const updateDebugReadout = (gazeX) => {
    if (!state.debug) return;
    const sample = window.Gaze.getLastSample();
    if (!sample) {
      elements.debugHint.textContent = "Debug: waiting for gaze samples… ←/→ fallback ready.";
      return;
    }
    const age = Math.round(window.Util.now() - sample.ts);
    const stale = window.Gaze.isStale();
    const smoothed = sample.smoothed;
    const rawText = `raw(${describeValue(sample.x)}, ${describeValue(sample.y)})`;
    const smoothText = smoothed ? `smooth(${describeValue(smoothed.x)}, ${describeValue(smoothed.y)})` : "smooth(—, —)";
    const canvasText = `canvasX ${describeValue(gazeX)}`;
    const statusText = stale ? `STALE ${age}ms` : `age ${age}ms`;
    elements.debugHint.textContent = `Debug: ${rawText} ${smoothText} ${canvasText} — ${statusText}. ←/→ fallback ready.`;
  };

  const handleScore = (winner) => {
    if (winner === "human") {
      state.scores.human += 1;
      prepareServe(-1);
    } else {
      state.scores.cpu += 1;
      prepareServe(1);
    }
    updateScoreboard();
    if (state.scores.human >= CONFIG.SCORE_WIN || state.scores.cpu >= CONFIG.SCORE_WIN) {
      endMatch();
    }
  };

  const endMatch = () => {
    stopLoop();
    const winner = state.scores.human > state.scores.cpu ? "You win!" : "CPU wins!";
    showOverlay({ text: `${winner} Play again?`, resume: false, playAgain: true });
    state.phase = "GAMEOVER";
  };

  const resetMatch = () => {
    hideOverlay();
    resetGameObjects();
    state.scores.cpu = 0;
    state.scores.human = 0;
    updateScoreboard();
    state.phase = "COUNTDOWN";
    prepareServe(-1);
    startLoop();
  };

  const pauseGame = (reason) => {
    if (state.phase !== "PLAYING") return;
    stopLoop();
    state.phase = "PAUSED";
    togglePauseButtons(true);
    showOverlay({ text: reason, resume: true, playAgain: false });
  };

  const resumeGame = () => {
    if (state.phase !== "PAUSED") return;
    hideOverlay();
    togglePauseButtons(false);
    state.lastGazeTs = window.Util.now();
    startLoop();
  };

  const quitToSplash = () => {
    stopLoop();
    hideOverlay();
    togglePauseButtons(false);
    state.phase = "SPLASH";
    showSection(elements.splash);
  };

  const turnCameraOff = async () => {
    await window.Gaze.stop();
    state.cameraActive = false;
    elements.cameraOffBtn.hidden = true;
    stopLoop();
    hideOverlay();
    togglePauseButtons(false);
    state.phase = "SPLASH";
    showSection(elements.statusPanel);
    setStatus("Camera off. Ready when you are.");
    elements.retryBtn.classList.remove("hidden");
  };

  const showOverlay = ({ text, resume, playAgain }) => {
    elements.overlayText.textContent = text;
    elements.overlay.classList.remove("hidden");
    elements.resumeOverlayBtn.classList.toggle("hidden", !resume);
    elements.playAgainBtn.classList.toggle("hidden", !playAgain);
  };

  const hideOverlay = () => {
    elements.overlay.classList.add("hidden");
  };

  const draw = () => {
    ctx.clearRect(0, 0, CONFIG.ARENA_W, CONFIG.ARENA_H);
    drawArena();
    drawPaddle(paddles.cpu);
    drawPaddle(paddles.human);
    drawBall();
    drawCountdown();
  };

  const drawArena = () => {
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, CONFIG.ARENA_W, CONFIG.ARENA_H);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.moveTo(0, CONFIG.ARENA_H / 2);
    ctx.lineTo(CONFIG.ARENA_W, CONFIG.ARENA_H / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawPaddle = (paddle) => {
    ctx.fillStyle = paddle.side === "top" ? "#3ad6ff" : "#f4f6ff";
    ctx.fillRect(
      paddle.x - CONFIG.PADDLE_W / 2,
      paddle.y - CONFIG.PADDLE_H / 2,
      CONFIG.PADDLE_W,
      CONFIG.PADDLE_H
    );
  };

  const drawBall = () => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(
      ball.x - CONFIG.BALL_SIZE / 2,
      ball.y - CONFIG.BALL_SIZE / 2,
      CONFIG.BALL_SIZE,
      CONFIG.BALL_SIZE
    );
  };

  const drawCountdown = () => {
    if (!state.freezeUntil) return;
    const remaining = Math.max(0, state.freezeUntil - window.Util.now());
    if (remaining <= 0) return;
    const count = Math.ceil(remaining / 1000);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(count), CONFIG.ARENA_W / 2, CONFIG.ARENA_H / 2);
    ctx.textAlign = "start";
  };

  init();
})();
