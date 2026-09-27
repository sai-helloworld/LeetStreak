/**
 * Procedural Tree Generation on Canvas
 */
export function drawTree(ctx, x, y, len, angle, branchWidth, streakDays) {
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = "#4A2E13";
  ctx.fillStyle = streakDays > 30 ? "#1b5e20" : "#2e7d32";
  ctx.lineWidth = branchWidth;
  ctx.lineCap = "round";

  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -len);
  ctx.stroke();

  // Draw leaves when reaching terminal branches
  if (len < 8) {
    ctx.beginPath();
    const leafRadius = Math.min(3 + streakDays * 0.2, 8);
    ctx.arc(0, -len, leafRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const shrinkFactor = 0.72;
  const spreadAngle = 20 + Math.min(streakDays, 15);

  drawTree(
    ctx,
    0,
    -len,
    len * shrinkFactor,
    -spreadAngle,
    branchWidth * 0.7,
    streakDays,
  );
  drawTree(
    ctx,
    0,
    -len,
    len * shrinkFactor,
    spreadAngle,
    branchWidth * 0.7,
    streakDays,
  );

  // Extra middle branch for mature trees (>10 days streak)
  if (streakDays > 10) {
    drawTree(
      ctx,
      0,
      -len,
      len * shrinkFactor * 0.8,
      0,
      branchWidth * 0.6,
      streakDays,
    );
  }

  ctx.restore();
}

/**
 * Draws the active main tree dynamically scaled to streak length
 */
export function renderMainTree(canvas, streakDays) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (streakDays === 0) {
    // Sprout placeholder for 0-day streak
    ctx.fillStyle = "#8B5A2B";
    ctx.fillRect(canvas.width / 2 - 10, canvas.height - 10, 20, 5);
    ctx.fillStyle = "#81C784";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height - 12, 4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const trunkLength = Math.min(25 + streakDays * 2.5, 80);
  const trunkWidth = Math.min(3 + streakDays * 0.4, 12);

  drawTree(
    ctx,
    canvas.width / 2,
    canvas.height - 15,
    trunkLength,
    0,
    trunkWidth,
    streakDays,
  );
}
