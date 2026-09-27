import { fetchLeetCodeDates, calculateFullHistoryForest } from '../utils/platform_fetchers.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('syncStreakAlarm', { periodInMinutes: 360 });
  syncData();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncStreakAlarm') {
    syncData();
  }
});

export async function syncData() {
  const storage = await chrome.storage.local.get(['profiles']);
  const profiles = storage.profiles || {};

  if (!profiles.leetcode) {
    const emptyForest = { currentStreak: 0, forest: [] };
    await chrome.storage.local.set({ forestData: emptyForest });
    return emptyForest;
  }

  // Fetch full submission history from LeetCode
  const leetCodeDates = await fetchLeetCodeDates(profiles.leetcode);

  // Compute full historical forest & current streak
  const forestData = calculateFullHistoryForest(leetCodeDates);
  forestData.lastSynced = new Date().toISOString();

  await chrome.storage.local.set({ forestData });
  return forestData;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'manual_sync') {
    syncData().then(updatedData => sendResponse({ status: 'success', data: updatedData }));
    return true;
  }
});