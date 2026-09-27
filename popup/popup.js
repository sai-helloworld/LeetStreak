import { init3DWorld, update3DForest } from "./utils/forest_3d.js";

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("cyberCanvas");

  // 1. Initialize 3D Engine
  init3DWorld(canvas);

  // 2. Sample Calendar Data Feed (Simulates Daily Submissions)
  const sampleCalendarData = [
    { date: "2026-09-01", hasCoded: true, streakCount: 1, isStreakEnd: false },
    { date: "2026-09-02", hasCoded: true, streakCount: 2, isStreakEnd: false },
    { date: "2026-09-03", hasCoded: true, streakCount: 3, isStreakEnd: true }, // Streak completes -> Spawns Road
    { date: "2026-09-04", hasCoded: false }, // Inactive Plot
    { date: "2026-09-05", hasCoded: false }, // Merges with plot above
    { date: "2026-09-06", hasCoded: true, streakCount: 1, isStreakEnd: false },
    { date: "2026-09-07", hasCoded: true, streakCount: 2, isStreakEnd: false },
    { date: "2026-09-08", hasCoded: true, streakCount: 3, isStreakEnd: false },
    { date: "2026-09-09", hasCoded: true, streakCount: 4, isStreakEnd: false },
    { date: "2026-09-10", hasCoded: true, streakCount: 5, isStreakEnd: true }, // Spawns Road
    { date: "2026-09-11", hasCoded: false },
    { date: "2026-09-12", hasCoded: true, streakCount: 1, isStreakEnd: false },
    { date: "2026-09-13", hasCoded: true, streakCount: 2, isActive: true }, // Current Active Streak
  ];

  // 3. Render 3D Calendar Matrix
  update3DForest(2, sampleCalendarData);
});
