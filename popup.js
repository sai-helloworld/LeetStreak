import { init3DWorld, update3DForest } from "./utils/forest_3d.js";
import { fetchLeetCodeData } from "./utils/leetcode_api.js";

document.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM references ----------
  const canvas = document.getElementById("cyberCanvas");
  const streakBadge = document.getElementById("currentStreakBadge");
  const usernameInput = document.getElementById("usernameInput");
  const fetchBtn = document.getElementById("fetchBtn");
  const loadingOverlay = document.getElementById("loadingOverlay");

  // Analytics panel
  const debugStatus = document.getElementById("debugStatus");
  const statActiveDays = document.getElementById("statActiveDays");
  const statTotalSubs = document.getElementById("statTotalSubs");
  const statCurrentStreak = document.getElementById("statCurrentStreak");
  const statLongestStreak = document.getElementById("statLongestStreak");
  const statMaxDay = document.getElementById("statMaxDay");
  const statLongestTower = document.getElementById("statLongestTower");
  const statTotalStreaks = document.getElementById("statTotalStreaks");
  const statAvgPerDay = document.getElementById("statAvgPerDay");
  const analyticsLog = document.getElementById("analyticsLog");

  // Info icon + legend modal
  const infoBtn = document.getElementById("infoBtn");
  const legendModal = document.getElementById("legendModal");
  const legendClose = document.getElementById("legendClose");

  // First-run welcome
  const welcomeOverlay = document.getElementById("welcomeOverlay");
  const welcomeUsernameInput = document.getElementById("welcomeUsernameInput");
  const welcomeStartBtn = document.getElementById("welcomeStartBtn");

  // ---------- 3D world ----------
  init3DWorld(canvas);

  // ---------- First-run check ----------
  chrome.storage.local.get(["leetcodeUsername"], (res) => {
    const savedUser = res.leetcodeUsername;

    if (savedUser && savedUser.trim()) {
      // Returning user — auto-load their saved username
      usernameInput.value = savedUser;
      loadUserProfile(savedUser);
    } else {
      // First run — show welcome, do NOT fetch anything yet
      openWelcome();
    }
  });

  // ---------- Header fetch button ----------
  fetchBtn.addEventListener("click", () => {
    const username = usernameInput.value.trim();
    if (!username) {
      analyticsLog.innerText = "> Please enter a LeetCode username.";
      return;
    }
    chrome.storage.local.set({ leetcodeUsername: username });
    loadUserProfile(username);
  });

  // Also allow Enter key in the header input
  usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") fetchBtn.click();
  });

  // ============================================================
  // WELCOME OVERLAY
  // ============================================================
  function openWelcome() {
    welcomeOverlay.classList.add("open");
    welcomeOverlay.setAttribute("aria-hidden", "false");
    // Focus the input after the overlay is visible
    setTimeout(() => welcomeUsernameInput.focus(), 50);
  }

  function closeWelcome() {
    welcomeOverlay.classList.remove("open");
    welcomeOverlay.setAttribute("aria-hidden", "true");
  }

  function submitWelcome() {
    const username = welcomeUsernameInput.value.trim();
    if (!username) {
      welcomeUsernameInput.focus();
      welcomeUsernameInput.style.borderColor = "#ff0055";
      welcomeUsernameInput.style.boxShadow = "0 0 8px rgba(255,0,85,0.5)";
      setTimeout(() => {
        welcomeUsernameInput.style.borderColor = "";
        welcomeUsernameInput.style.boxShadow = "";
      }, 900);
      return;
    }

    // Save + reflect in the header input
    chrome.storage.local.set({ leetcodeUsername: username });
    usernameInput.value = username;
    closeWelcome();
    loadUserProfile(username);
  }

  welcomeStartBtn?.addEventListener("click", submitWelcome);

  welcomeUsernameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitWelcome();
  });

  // ============================================================
  // LEGEND MODAL
  // ============================================================
  function openLegend() {
    legendModal.classList.add("open");
    legendModal.setAttribute("aria-hidden", "false");
  }

  function closeLegend() {
    legendModal.classList.remove("open");
    legendModal.setAttribute("aria-hidden", "true");
  }

  infoBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openLegend();
  });

  legendClose?.addEventListener("click", closeLegend);

  legendModal?.addEventListener("click", (e) => {
    if (e.target === legendModal) closeLegend();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLegend();
  });

  // ============================================================
  // PROFILE LOADING
  // ============================================================
  async function loadUserProfile(username) {
    loadingOverlay.style.display = "flex";

    setDebugStatus("FETCHING...", "status-loading");
    resetAnalytics();
    analyticsLog.innerText = `> Fetching LeetCode history for "${username}"...`;

    try {
      const { currentStreak, history } = await fetchLeetCodeData(username);

      if (streakBadge) {
        streakBadge.innerText = `STREAK: ${currentStreak} DAYS`;
      }

      update3DForest(currentStreak, history);

      const analytics = computeAnalytics(history, currentStreak);
      renderAnalytics(analytics);

      setDebugStatus("READY", "status-success");
      analyticsLog.innerText =
        `> [OK] ${analytics.activeDays} active days · ` +
        `${analytics.totalSubs} submissions · ` +
        `${analytics.totalStreaks} streak blocks · ` +
        `current streak ${analytics.currentStreak}d · ` +
        `longest streak ${analytics.longestStreak}d.`;
    } catch (err) {
      setDebugStatus("FAILED", "status-error");
      analyticsLog.innerText = `> [ERROR] ${err.message}`;

      // If we were loading a *stored* username that no longer exists,
      // reopen the welcome overlay so the user can fix it.
      const stored = await new Promise((r) =>
        chrome.storage.local.get(["leetcodeUsername"], (res) =>
          r(res.leetcodeUsername),
        ),
      );
      if (stored === username) {
        chrome.storage.local.remove("leetcodeUsername");
      }
      openWelcome();
    } finally {
      loadingOverlay.style.display = "none";
    }
  }

  // ============================================================
  // STATUS + PANEL HELPERS
  // ============================================================
  function setDebugStatus(text, statusClass) {
    debugStatus.innerText = text;
    debugStatus.className = `debug-status-tag ${statusClass}`;
  }

  function resetAnalytics() {
    statActiveDays.innerText = "--";
    statTotalSubs.innerText = "--";
    statCurrentStreak.innerText = "--";
    statLongestStreak.innerText = "--";
    statMaxDay.innerText = "--";
    statLongestTower.innerText = "--";
    statTotalStreaks.innerText = "--";
    statAvgPerDay.innerText = "--";
  }

  function renderAnalytics(a) {
    statActiveDays.innerText = `${a.activeDays} / ${a.totalDays}`;
    statTotalSubs.innerText = `${a.totalSubs}`;
    statCurrentStreak.innerText = `${a.currentStreak} d`;
    statLongestStreak.innerText = `${a.longestStreak} d`;
    statMaxDay.innerText = `${a.maxDaySubs} subs`;
    statLongestTower.innerText = `${a.longestTower}m`;
    statTotalStreaks.innerText = `${a.totalStreaks}`;
    statAvgPerDay.innerText = `${a.avgPerActiveDay}`;
  }

  // ============================================================
  // ANALYTICS COMPUTATION
  // ============================================================
  function computeAnalytics(history, currentStreak) {
    if (!history || history.length === 0) {
      return {
        activeDays: 0,
        totalDays: 0,
        totalSubs: 0,
        currentStreak: 0,
        longestStreak: 0,
        maxDaySubs: 0,
        maxDayDate: "-",
        longestTower: "0.0",
        longestTowerDate: "-",
        totalStreaks: 0,
        avgPerActiveDay: "0.0",
      };
    }

    let activeDays = 0;
    let totalSubs = 0;
    let maxDaySubs = 0;
    let maxDayDate = "-";
    let longestTower = 0;
    let longestTowerDate = "-";

    for (const day of history) {
      if (day.hasCoded) activeDays++;
      totalSubs += day.submissions;

      if (day.submissions > maxDaySubs) {
        maxDaySubs = day.submissions;
        maxDayDate = day.date;
      }

      if (day.hasCoded) {
        const platform = day.platformHeight || 0;
        const floors = Math.max(1, Math.min(20, Math.floor(day.submissions)));
        const towerHeight = platform + floors;
        if (towerHeight > longestTower) {
          longestTower = towerHeight;
          longestTowerDate = day.date;
        }
      }
    }

    let longestStreak = 0;
    let currentRun = 0;
    let totalStreaks = 0;
    for (const day of history) {
      if (day.hasCoded) {
        currentRun++;
        if (currentRun === 1) totalStreaks++;
        if (currentRun > longestStreak) longestStreak = currentRun;
      } else {
        currentRun = 0;
      }
    }

    const avgPerActiveDay =
      activeDays > 0 ? (totalSubs / activeDays).toFixed(1) : "0.0";

    return {
      activeDays,
      totalDays: history.length,
      totalSubs,
      currentStreak,
      longestStreak,
      maxDaySubs,
      maxDayDate,
      longestTower: longestTower.toFixed(1),
      longestTowerDate,
      totalStreaks,
      avgPerActiveDay,
    };
  }
});
