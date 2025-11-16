# Eyeball Pong

**Play pong with your eyes.** No hands, no controllers—just your webcam and your gaze.

Built for the Claude Builder Hackathon at Purdue University (November 9, 2025) using Claude Code and WebGazer.js.

## What is this?

Eyeball Pong is a classic Pong game controlled entirely by eye tracking. Look left and right to move your paddle and rally against a CPU opponent. Your webcam data never leaves your browser—everything runs locally for complete privacy.

## Tech Stack

- **Vanilla JavaScript** - No frameworks, just clean modular ES6
- **WebGazer.js** - Real-time eye tracking in the browser
- **HTML5 Canvas** - Smooth 60fps game rendering
- **CSS3** - Responsive UI and animations

## How It Works

### Eye Tracking Pipeline

1. **WebGazer** captures your gaze position from webcam video
2. **16-point calibration** maps screen coordinates to game canvas using custom linear regression
3. **Exponential smoothing filter** (α=0.25) reduces jitter while maintaining responsiveness
4. **Deadband threshold** (6px) prevents micro-movements from causing paddle drift
5. **Staleness detection** pauses the game if tracking is lost for >300ms

### Game Architecture

The codebase is organized into modular namespaces:

- **`main.js`** - Game loop, state machine, UI orchestration
- **`webgazer-setup.js`** - Eye tracking wrapper with custom calibration
- **`physics.js`** - Ball movement, collision detection, paddle reflection
- **`ai.js`** - Simple follow-the-ball CPU opponent
- **`util.js`** - Math helpers (clamp, lerp, device detection)

### State Machine

```
SPLASH → CALIBRATION → COUNTDOWN → PLAYING ⇄ PAUSED → GAMEOVER
```

## Notable Features

- **Privacy-first**: Camera data processed entirely client-side
- **Custom calibration**: Linear regression mapping instead of WebGazer's default
- **Adjustable difficulty**: URL params (`?easy=1` or `?hard=1`) control CPU speed
- **Debug mode**: `?debug=1` enables keyboard fallback (←/→ arrows) and diagnostic overlay
- **Laptop detection**: Blocks touch devices to prevent accidental taps during calibration
- **Recalibration**: Adjust tracking mid-game without losing your score
- **Progressive ball speed**: Ball accelerates on each paddle hit (capped at 2× base speed)

## Running Locally

1. Clone the repo
2. Serve the `public/` directory with any static file server:
   ```bash
   # Python 3
   python -m http.server 8000

   # Node.js
   npx serve public
   ```
3. Open `http://localhost:8000` in Chrome, Edge, or Firefox
4. Allow webcam access and follow the calibration prompts

## Tips for Best Results

- **Lighting matters**: Face a window or lamp for better face detection
- **Stay centered**: Keep your face roughly 50-70cm from the screen
- **Calibrate carefully**: Click each dot while staring directly at it
- **Minimal head movement**: Small head tilts are fine, but avoid swaying
- **Chrome recommended**: Works best in Chromium-based browsers

## Hackathon Context

This project was built in ~3 hours during the Claude Builder Hackathon at Purdue on November 9, 2025. The goal was to explore what's possible with AI-assisted development (Claude Code) and browser-based eye tracking.

Key learnings:
- WebGazer's default calibration struggles with small, fast-moving targets
- Custom calibration with dense grid sampling (16 points) significantly improves accuracy
- Exponential smoothing + deadband is crucial for playable eye-controlled games
- Privacy-preserving ML (on-device processing) enables novel interaction paradigms

## License

MIT - Do whatever you want with it.

## Acknowledgments

- [WebGazer.js](https://webgazer.cs.brown.edu/) by Brown University HCI Group
- Built with [Claude Code](https://claude.ai/code)
- Hackathon organized by Purdue Builder's Club & Anthropic
