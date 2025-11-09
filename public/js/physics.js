window.Physics = (() => {
  const { clamp, randRange } = window.Util;

  const createBall = (config) => ({
    x: config.ARENA_W / 2,
    y: config.ARENA_H / 2,
    vx: 0,
    vy: 0,
    size: config.BALL_SIZE,
  });

  const resetBall = (ball, config) => {
    ball.x = config.ARENA_W / 2;
    ball.y = config.ARENA_H / 2;
    ball.vx = 0;
    ball.vy = 0;
  };

  const serveBall = (ball, direction, config) => {
    const vy = direction * config.BALL_SPEED_INIT;
    const vx = randRange(-3, 3);
    ball.vx = vx;
    ball.vy = vy;
  };

  const rectsOverlap = (ballRect, paddleRect) =>
    ballRect.left < paddleRect.right &&
    ballRect.right > paddleRect.left &&
    ballRect.top < paddleRect.bottom &&
    ballRect.bottom > paddleRect.top;

  const getBallRect = (ball) => {
    const half = ball.size / 2;
    return {
      left: ball.x - half,
      right: ball.x + half,
      top: ball.y - half,
      bottom: ball.y + half,
    };
  };

  const getPaddleRect = (paddle, config) => {
    const halfW = config.PADDLE_W / 2;
    const halfH = config.PADDLE_H / 2;
    return {
      left: paddle.x - halfW,
      right: paddle.x + halfW,
      top: paddle.y - halfH,
      bottom: paddle.y + halfH,
    };
  };

  const reflectFromPaddle = (ball, paddle, config) => {
    const half = ball.size / 2;
    if (paddle.side === "top") {
      ball.y = paddle.y + config.PADDLE_H / 2 + half;
    } else {
      ball.y = paddle.y - config.PADDLE_H / 2 - half;
    }
    ball.vy = -ball.vy;
    const offset = clamp((ball.x - paddle.x) / (config.PADDLE_W / 2), -1, 1);
    ball.vx += offset * 3;

    const speed = Math.hypot(ball.vx, ball.vy) || 1;
    const target = Math.min(config.BALL_SPEED_MAX, Math.max(speed + config.BALL_ACCEL, config.BALL_SPEED_INIT));
    const scale = target / speed;
    ball.vx *= scale;
    ball.vy *= scale;
  };

  const updateBall = (ball, human, cpu, config, dt, onScore) => {
    if (!dt) return;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    const half = ball.size / 2;
    if (ball.x - half <= 0 && ball.vx < 0) {
      ball.x = half;
      ball.vx = -ball.vx;
    } else if (ball.x + half >= config.ARENA_W && ball.vx > 0) {
      ball.x = config.ARENA_W - half;
      ball.vx = -ball.vx;
    }

    const ballRect = getBallRect(ball);
    const humanRect = getPaddleRect(human, config);
    const cpuRect = getPaddleRect(cpu, config);

    if (ball.vy > 0 && rectsOverlap(ballRect, humanRect)) {
      reflectFromPaddle(ball, human, config);
    } else if (ball.vy < 0 && rectsOverlap(ballRect, cpuRect)) {
      reflectFromPaddle(ball, cpu, config);
    }

    if (ball.y + half < 0) {
      onScore("human");
      return;
    }
    if (ball.y - half > config.ARENA_H) {
      onScore("cpu");
      return;
    }
  };

  return {
    createBall,
    resetBall,
    serveBall,
    updateBall,
  };
})();
