/**
 * EchoPulse Local Intent Router — 0% LLM overhead, instant regex matching
 */

export interface RouterMatch {
  pattern: string;
  action: string;
  reply: string;
  data?: Record<string, string | undefined>;
}

export interface RouterResult {
  matched: boolean;
  match?: RouterMatch;
}

// ─── Pattern Definitions ────────────────────────────────────────────────────

const PATTERNS: Array<{
  pattern: RegExp;
  action: string;
  handler: (m: RegExpMatchArray) => { reply: string; data?: Record<string, string | undefined> };
}> = [
  // Time & Date
  {
    pattern: /\b(what('s| is) the time|what time is it|current time)\b/i,
    action: "time",
    handler: () => {
      const now = new Date();
      return { reply: `The current time is ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` };
    },
  },
  {
    pattern: /\b(what('s| is) (the |today('s)? )?date|what day is (it|today))\b/i,
    action: "date",
    handler: () => {
      const now = new Date();
      return { reply: `Today is ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.` };
    },
  },

  // Tasks — Add
  {
    pattern: /\badd (.+?) to (my )?(list|tasks|to-?do)\b/i,
    action: "task_add",
    handler: (m) => ({
      reply: `Added "${m[1]}" to your task list.`,
      data: { taskText: m[1] },
    }),
  },
  {
    pattern: /\b(remind me to|create a? task (to )?|add task )(.+)/i,
    action: "task_add",
    handler: (m) => ({
      reply: `Added "${m[3]}" to your task list.`,
      data: { taskText: m[3] },
    }),
  },

  // Tasks — Show
  {
    pattern: /\b(show|list|what('s| are)( on)?( my)?) (tasks|to-?do|list)\b/i,
    action: "task_list",
    handler: () => ({ reply: "Here are your current tasks." }),
  },

  // Tasks — Complete
  {
    pattern: /\b(complete|finish|done with|mark as done|check off) (.+)/i,
    action: "task_complete",
    handler: (m) => ({
      reply: `Marked "${m[2]}" as complete.`,
      data: { taskText: m[2] },
    }),
  },

  // Music — Spotify
  {
    pattern: /\bplay (.+?) on spotify\b/i,
    action: "play_spotify",
    handler: (m) => ({
      reply: `Playing "${m[1]}" on Spotify.`,
      data: { query: m[1], platform: "spotify" },
    }),
  },

  // Music — YouTube
  {
    pattern: /\bplay (.+?) on youtube( music)?\b/i,
    action: "play_youtube",
    handler: (m) => ({
      reply: `Playing "${m[1]}" on YouTube Music.`,
      data: { query: m[1], platform: "youtube" },
    }),
  },

  // Music — generic play
  {
    pattern: /\bplay (.+)/i,
    action: "play_music",
    handler: (m) => ({
      reply: `Playing "${m[1]}".`,
      data: { query: m[1], platform: "default" },
    }),
  },

  // Volume
  {
    pattern: /\b(set |turn )?(volume|vol)(?: (up|down|to))?(?: (\d+))?\b/i,
    action: "volume",
    handler: (m) => {
      if (m[4] === "up") return { reply: "Volume increased.", data: { direction: "up" } };
      if (m[4] === "down") return { reply: "Volume decreased.", data: { direction: "down" } };
      if (m[5]) return { reply: `Volume set to ${m[5]}%.`, data: { level: m[5] } };
      return { reply: "Adjusting volume." };
    },
  },

  // Clear screen
  {
    pattern: /\b(clear (screen|history|log)|reset)\b/i,
    action: "clear_screen",
    handler: () => ({ reply: "Screen cleared." }),
  },

  // Greetings
  {
    pattern: /\b(hello|hi|hey echo(pulse)?|good (morning|afternoon|evening))\b/i,
    action: "greeting",
    handler: () => {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      return { reply: `Good ${greeting}! I'm EchoPulse. How can I help you today?` };
    },
  },

  // Help
  {
    pattern: /\b(help|what can you do|commands|what do you know)\b/i,
    action: "help",
    handler: () => ({
      reply: "I can handle time, date, tasks, music playback, and volume locally. For anything else, I'll ask Gemini AI.",
    }),
  },
];

// ─── Router Function ─────────────────────────────────────────────────────────

export function routeIntent(query: string): RouterResult {
  const normalizedQuery = query.trim().toLowerCase();

  for (const { pattern, action, handler } of PATTERNS) {
    const match = query.match(pattern) ?? normalizedQuery.match(pattern);
    if (match) {
      const result = handler(match);
      return {
        matched: true,
        match: {
          pattern: pattern.toString(),
          action,
          reply: result.reply,
          data: result.data,
        },
      };
    }
  }

  return { matched: false };
}

// ─── Preference Detector ─────────────────────────────────────────────────────

export function detectPreference(query: string): { category: string; platform: string } | null {
  const lower = query.toLowerCase();
  if (/spotify/i.test(lower)) return { category: "music", platform: "spotify" };
  if (/youtube/i.test(lower)) return { category: "music", platform: "youtube" };
  if (/apple music/i.test(lower)) return { category: "music", platform: "apple_music" };
  return null;
}
