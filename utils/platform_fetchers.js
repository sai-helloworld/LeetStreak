/**
 * Helper: Converts YYYY-MM-DD string into a clean UTC Date object (at 00:00:00)
 */
function parseUTCDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Converts UNIX timestamp (in seconds) to local YYYY-MM-DD string
 */
function timestampToLocalDateStr(timestampSeconds) {
  const date = new Date(timestampSeconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's local date as YYYY-MM-DD
 */
function getTodayLocalDateStr() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Fetch Full LeetCode submission history across multiple years
 */
export async function fetchLeetCodeDates(username) {
  if (!username) return new Set();
  const activeDates = new Set();

  try {
    // 1. Fetch available years in user's profile
    const userYearsQuery = `
      query userProfileCalendar($username: String!) {
        matchedUser(username: $username) {
          userCalendar {
            activeYears
          }
        }
      }
    `;

    const yearsResponse = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: userYearsQuery, variables: { username } }),
    });

    const yearsData = await yearsResponse.json();
    const activeYears =
      yearsData?.data?.matchedUser?.userCalendar?.activeYears || [];

    // Fallback if no years found
    if (activeYears.length === 0) {
      activeYears.push(new Date().getFullYear());
    }

    // 2. Fetch submission calendar for EACH active year
    for (const year of activeYears) {
      const yearCalendarQuery = `
        query userProfileCalendar($username: String!, $year: Int) {
          matchedUser(username: $username) {
            userCalendar(year: $year) {
              submissionCalendar
            }
          }
        }
      `;

      const response = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: yearCalendarQuery,
          variables: { username, year },
        }),
      });

      const data = await response.json();
      const rawCalendar =
        data?.data?.matchedUser?.userCalendar?.submissionCalendar;

      if (rawCalendar) {
        const calendar = JSON.parse(rawCalendar);
        Object.entries(calendar).forEach(([timestamp, count]) => {
          if (count > 0) {
            const localDateStr = timestampToLocalDateStr(
              parseInt(timestamp, 10),
            );
            activeDates.add(localDateStr);
          }
        });
      }
    }

    return activeDates;
  } catch (err) {
    console.error("LeetCode full history fetch error:", err);
    return activeDates;
  }
}

/**
 * Processes full date history to compute:
 * 1. Current Active Streak
 * 2. Historical Forest Array (All completed streaks + sizes)
 */
export function calculateFullHistoryForest(activeDatesSet) {
  if (!activeDatesSet || activeDatesSet.size === 0) {
    return { currentStreak: 0, forest: [] };
  }

  // Sort dates chronologically
  const sortedDates = Array.from(activeDatesSet).sort(
    (a, b) => parseUTCDate(a) - parseUTCDate(b),
  );

  const forest = [];
  let currentStreak = 0;
  let tempStreak = 1;

  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
      continue;
    }

    const prevDate = parseUTCDate(sortedDates[i - 1]);
    const currDate = parseUTCDate(sortedDates[i]);

    // Calculate exact day difference between consecutive submission days
    const diffTime = currDate.getTime() - prevDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

    if (diffDays === 1) {
      // Consecutive day: increment streak length
      tempStreak++;
    } else if (diffDays > 1) {
      // Streak broken: save tree with final streak size
      forest.push({
        id: `building_${sortedDates[i - 1]}`,
        finalStreak: tempStreak,
        endDate: sortedDates[i - 1],
      });
      tempStreak = 1; // Reset streak count for new sprout
    }
  }

  // Evaluate the last streak segment against today/yesterday
  const lastDateStr = sortedDates[sortedDates.length - 1];
  const todayStr = getTodayLocalDateStr();

  const lastDate = parseUTCDate(lastDateStr);
  const todayDate = parseUTCDate(todayStr);

  const diffFromTodayDays = Math.round(
    (todayDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24),
  );

  if (diffFromTodayDays <= 1) {
    // Active streak ongoing today or yesterday
    currentStreak = tempStreak;
  } else {
    // Streak ended prior to yesterday
    forest.push({
      id: `building_${lastDateStr}`,
      finalStreak: tempStreak,
      endDate: lastDateStr,
    });
    currentStreak = 0;
  }

  return { currentStreak, forest };
}
