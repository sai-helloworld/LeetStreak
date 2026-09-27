/**
 * Array of vibrant cyberpunk neon colors for continuous streaks
 */
const STREAK_PALETTE = [
  0x00f3ff, // Neon Cyan
  0xff0055, // Cyber Pink
  0x10b981, // Emerald Green
  0xf59e0b, // Amber Gold
  0x8b5cf6, // Purple
  0xec4899, // Hot Pink
  0x06b6d4, // Bright Teal
  0x84cc16, // Lime Green
];

export async function fetchLeetCodeData(username) {
  const startTime = performance.now();

  try {
    const activeYearsQuery = `
      query userActiveYears($username: String!) {
        matchedUser(username: $username) {
          userCalendar {
            activeYears
            streak
            totalActiveDays
          }
        }
      }
    `;

    const resYears = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: activeYearsQuery,
        variables: { username },
      }),
    });

    const yearsData = await resYears.json();
    if (!yearsData.data || !yearsData.data.matchedUser) {
      throw new Error(`User "${username}" not found on LeetCode.`);
    }

    const calendarInfo = yearsData.data.matchedUser.userCalendar;
    const activeYears = calendarInfo.activeYears || [new Date().getFullYear()];
    const currentStreak = calendarInfo.streak || 0;

    const calendarPromises = activeYears.map((year) => {
      const yearQuery = `
        query userCalendarForYear($username: String!, $year: Int) {
          matchedUser(username: $username) {
            userCalendar(year: $year) {
              submissionCalendar
            }
          }
        }
      `;
      return fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: yearQuery,
          variables: { username, year },
        }),
      }).then((r) => r.json());
    });

    const yearResults = await Promise.all(calendarPromises);

    let fullSubmissionMap = {};
    yearResults.forEach((yrRes) => {
      const calendarStr =
        yrRes?.data?.matchedUser?.userCalendar?.submissionCalendar;
      if (calendarStr) {
        Object.assign(fullSubmissionMap, JSON.parse(calendarStr));
      }
    });

    const history = parseFullLeetCodeHistory(fullSubmissionMap);
    const latency = Math.round(performance.now() - startTime);

    return {
      currentStreak,
      history,
      debug: {
        source: `LeetCode GraphQL (${activeYears.length} Years)`,
        latency: `${latency}ms`,
        rawEntriesCount: Object.keys(fullSubmissionMap).length,
        totalActiveDays: calendarInfo.totalActiveDays,
      },
    };
  } catch (err) {
    console.warn("Direct GraphQL failed, fallback proxy:", err);
    return fetchLeetCodeFallback(username, startTime);
  }
}

async function fetchLeetCodeFallback(username, startTime) {
  const res = await fetch(
    `https://alfa-leetcode-api.onrender.com/userProfileCalendar?username=${username}`,
  );
  const data = await res.json();

  if (!data || !data.submissionCalendar) {
    throw new Error(`Profile data for "${username}" unavailable via proxy.`);
  }

  const calendarRaw = JSON.parse(data.submissionCalendar || "{}");
  const history = parseFullLeetCodeHistory(calendarRaw);
  const latency = Math.round(performance.now() - startTime);

  return {
    currentStreak: data.streak || 0,
    history,
    debug: {
      source: "Alfa LeetCode Proxy",
      latency: `${latency}ms`,
      rawEntriesCount: Object.keys(calendarRaw).length,
      totalActiveDays: data.totalActiveDays || "N/A",
    },
  };
}

/**
 * Parses all submission records into continuous days, groups streaks (even across month bounds),
 * and computes overall streak lengths to elevate buildings on platforms.
 */
function parseFullLeetCodeHistory(submissionMap) {
  const parsedDateCounts = {};
  const timestamps = [];

  for (const [timestampStr, count] of Object.entries(submissionMap)) {
    const timestampSec = parseInt(timestampStr, 10);
    if (isNaN(timestampSec)) continue;

    timestamps.push(timestampSec);
    const submissionDate = new Date(timestampSec * 1000);
    const dateKey = submissionDate.toISOString().split("T")[0];
    parsedDateCounts[dateKey] =
      (parsedDateCounts[dateKey] || 0) + Number(count);
  }

  if (timestamps.length === 0) return [];

  const minTimestamp = Math.min(...timestamps);
  const startDate = new Date(minTimestamp * 1000);
  startDate.setDate(1); // Start from 1st of the month

  const endDate = new Date();
  const rawHistory = [];

  let curr = new Date(startDate);
  while (curr <= endDate) {
    const year = curr.getFullYear();
    const monthStr = String(curr.getMonth() + 1).padStart(2, "0");
    const dayStr = String(curr.getDate()).padStart(2, "0");
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    const utcDateStr = curr.toISOString().split("T")[0];

    const count =
      parsedDateCounts[dateStr] || parsedDateCounts[utcDateStr] || 0;

    rawHistory.push({
      date: dateStr,
      year,
      month: curr.getMonth(), // 0-11
      day: curr.getDate(),
      dayOfWeek: curr.getDay(),
      hasCoded: count > 0,
      submissions: count,
    });

    curr.setDate(curr.getDate() + 1);
  }

  // FIRST PASS: Identify continuous streaks across ALL months and compute TOTAL streak lengths
  const streakGroups = []; // Array of { streakId, totalLength, color }
  let currentStreakGroup = null;
  let globalStreakId = 0;

  for (let i = 0; i < rawHistory.length; i++) {
    const day = rawHistory[i];

    if (day.hasCoded) {
      if (!currentStreakGroup) {
        globalStreakId++;
        const color =
          STREAK_PALETTE[(globalStreakId - 1) % STREAK_PALETTE.length];
        currentStreakGroup = {
          streakId: globalStreakId,
          totalLength: 0,
          color,
          days: [],
        };
        streakGroups.push(currentStreakGroup);
      }

      currentStreakGroup.totalLength++;
      currentStreakGroup.days.push(day);

      day.streakId = currentStreakGroup.streakId;
      day.streakColor = currentStreakGroup.color;
      day.dayInStreak = currentStreakGroup.totalLength;
    } else {
      currentStreakGroup = null;
    }
  }

  // SECOND PASS: Attach overall total streak length to every day in that streak block
  rawHistory.forEach((day) => {
    if (day.hasCoded && day.streakId) {
      const parentGroup = streakGroups.find((g) => g.streakId === day.streakId);
      if (parentGroup) {
        day.totalStreakLength = parentGroup.totalLength;
        // Platform height is proportional to total streak length (e.g. 0.8 units per day up to max 18)
        day.platformHeight = Math.min(
          18,
          Math.max(1.2, parentGroup.totalLength * 0.8),
        );
      }
    }
  });

  return rawHistory;
}
