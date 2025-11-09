window.CpuAI = (() => {
  const follow = (currentY, targetY, speed, dt, margin = 4) => {
    const delta = targetY - currentY;
    if (Math.abs(delta) <= margin) {
      return currentY;
    }
    const direction = delta > 0 ? 1 : -1;
    return currentY + direction * speed * dt;
  };

  return { follow };
})();
