import { init3DWorld, update3DForest } from "../utils/forest_3d.js";

document.addEventListener("DOMContentLoaded", async () => {
  const canvas = document.getElementById("forest3dCanvas");
  canvas.width = 360;
  canvas.height = 240;

  // Initialize Cyberpunk 3D Canvas
  init3DWorld(canvas);

  const streakCountEl = document.getElementById("streakCount");
  const syncBtn = document.getElementById("syncBtn");
  const profileForm = document.getElementById("profileForm");

  // Inspector & HUD elements
  const activeTreeSizeEl = document.getElementById("activeTreeSize");
  const totalForestCountEl = document.getElementById("totalForestCount");
  const treeSizeListEl = document.getElementById("treeSizeList");
  const hudCardEl = document.getElementById("hudCard");

  // Load saved state
  const { profiles = {}, forestData = { currentStreak: 0, forest: [] } } =
    await chrome.storage.local.get(["profiles", "forestData"]);

  document.getElementById("leetcodeInput").value = profiles.leetcode || "";

  // Render initial view
  updateUI(forestData);

  // Listen for Interactive 3D Building Clicks
  window.addEventListener("buildingSelected", (e) => {
    const data = e.detail;
    hudCardEl.style.display = "block";
    hudCardEl.innerHTML = `
      <div class="hud-header">
        <span>🏢 ${data.rank}</span>
        <button id="closeHud">&times;</button>
      </div>
      <div class="hud-body">
        <div><strong>Floors / Days:</strong> ${data.streakDays}</div>
        <div><strong>Status / Date:</strong> ${data.endDate}</div>
      </div>
    `;

    document.getElementById("closeHud").addEventListener("click", () => {
      hudCardEl.style.display = "none";
    });
  });

  // Form submit event
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("leetcodeInput").value.trim();
    await chrome.storage.local.set({ profiles: { leetcode: username } });
    triggerSync();
  });

  // Manual Sync
  syncBtn.addEventListener("click", triggerSync);

  function triggerSync() {
    syncBtn.innerText = "⏳";
    chrome.runtime.sendMessage({ action: "manual_sync" }, (response) => {
      syncBtn.innerText = "🔄";
      if (response?.data) {
        updateUI(response.data);
      }
    });
  }

  function updateUI(data) {
    const streak = data.currentStreak || 0;
    const forest = data.forest || [];

    // 1. Update Badge
    streakCountEl.innerText = streak;

    // 2. Update 3D City
    update3DForest(streak, forest);

    // 3. Update Building Inspector Panel
    activeTreeSizeEl.innerText = `${streak} floor(s) high`;
    totalForestCountEl.innerText = `${forest.length} building(s)`;

    treeSizeListEl.innerHTML = "";

    if (forest.length === 0) {
      treeSizeListEl.innerHTML =
        '<div class="empty-list">No completed past buildings yet</div>';
      return;
    }

    // List all historical buildings with floor counts
    forest.forEach((building, idx) => {
      const chip = document.createElement("div");
      chip.className = "tree-chip";
      chip.innerHTML = `
        <span class="tree-id">Building #${idx + 1}</span>
        <span class="tree-size">🏢 Floors: <strong>${building.finalStreak}</strong></span>
        <span class="tree-date">${building.endDate || "Past"}</span>
      `;
      treeSizeListEl.appendChild(chip);
    });
  }
});
