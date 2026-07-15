// Calendar Feed client — talks to the ICS token endpoint (built separately).
// Contract: GET /api/calendar/token  → { token, feedUrl }  (creates if absent)
//           POST /api/calendar/token → { token, feedUrl }  (rotates; old URL dies)
// The route may not exist yet in a given deploy — callers must surface the
// thrown error gracefully rather than assuming the feed is available.

export interface CalendarFeedInfo {
  token: string;
  feedUrl: string;
}

async function requestFeed(method: "GET" | "POST"): Promise<CalendarFeedInfo> {
  let res: Response;
  try {
    res = await fetch("/api/calendar/token", { method });
  } catch {
    throw new Error("Calendar feed service is unreachable. Try again later.");
  }
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "The calendar feed service isn't available on this deployment yet."
        : `Calendar feed request failed (${res.status}). Try again later.`,
    );
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("Calendar feed service returned an unexpected response.");
  }
  const info = data as Partial<CalendarFeedInfo> | null;
  if (!info || typeof info.feedUrl !== "string" || typeof info.token !== "string") {
    throw new Error("Calendar feed service returned an unexpected response.");
  }
  return { token: info.token, feedUrl: info.feedUrl };
}

/** Fetch (or lazily create) the current ICS feed URL for this user. */
export function fetchCalendarFeed(): Promise<CalendarFeedInfo> {
  return requestFeed("GET");
}

/** Rotate the feed token — the previous URL stops working immediately. */
export function rotateCalendarFeed(): Promise<CalendarFeedInfo> {
  return requestFeed("POST");
}
