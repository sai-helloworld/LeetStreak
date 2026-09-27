import { init3DWorld, update3DForest } from "./utils/forest_3d.js";
import { fetchLeetCodeData } from "./utils/leetcode_api.js";

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("cyberCanvas");
  const streakBadge = document.getElementById("currentStreakBadge");
  const usernameInput = document.getElementById("usernameInput");
  const fetchBtn = document.getElementById("fetchBtn");
  const loadingOverlay = document.getElementById("loadingOverlay");

  const debugStatus = document.getElementById("debugStatus");
  const debugUsername = document.getElementById("debugUsername");
  const debugSource = document.getElementById("debugSource");
  const debugActiveDays = document.getElementById("debugActiveDays");
  const debugTotalSubs = document.getElementById("debugTotalSubs");
  const debugLog = document.getElementById("debugLog");

  init3DWorld(canvas);

  chrome.storage.local.get(["leetcodeUsername"], (res) => {
    const initialUser = res.leetcodeUsername || "leetcode";
    usernameInput.value = initialUser;
    loadUserProfile(initialUser);
  });

  fetchBtn.addEventListener("click", () => {
    const username = usernameInput.value.trim();
    if (username) {
      chrome.storage.local.set({ leetcodeUsername: username });
      loadUserProfile(username);
    }
  });

  async function loadUserProfile(username) {
    loadingOverlay.style.display = "flex";

    setDebugStatus("FETCHING...", "status-loading");
    debugUsername.innerText = username;
    debugSource.innerText = "Connecting...";
    debugActiveDays.innerText = "...";
    debugTotalSubs.innerText = "...";
    debugLog.innerText = `> Fetching complete multi-year LeetCode history for "${username}"...`;

    try {
      const { currentStreak, history, debug } =
        await fetchLeetCodeData(username);

      if (streakBadge) {
        streakBadge.innerText = `STREAK: ${currentStreak} DAYS`;
      }

      // Render entire 3D Matrix
      update3DForest(currentStreak, history);

      // Full history calculations
      const totalActiveDays = history.filter((d) => d.hasCoded).length;
      const totalSubmissions = history.reduce(
        (sum, d) => sum + d.submissions,
        0,
      );
      const totalDaysInSpan = history.length;

      setDebugStatus("FETCH OK", "status-success");
      debugSource.innerText = `${debug.source} (${debug.latency})`;
      debugActiveDays.innerText = `${totalActiveDays} / ${totalDaysInSpan} Days`;
      debugTotalSubs.innerText = `${totalSubmissions} Submissions`;
      debugLog.innerText = `> [SUCCESS] Retrieved ${debug.rawEntriesCount} calendar entries across ${totalDaysInSpan} total days.\n> Full History: ${totalActiveDays} active coding days, ${totalSubmissions} total submissions. Current streak: ${currentStreak}d.`;
    } catch (err) {
      setDebugStatus("FAILED", "status-error");
      debugSource.innerText = "Error";
      debugLog.innerText = `> [ERROR] ${err.message}`;
      alert(`Error loading profile for "${username}": ${err.message}`);
    } finally {
      loadingOverlay.style.display = "none";
    }
  }

  function setDebugStatus(text, statusClass) {
    debugStatus.innerText = text;
    debugStatus.className = `debug-status-tag ${statusClass}`;
  }
});
