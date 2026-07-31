import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tasksTable, commandLogsTable, preferencesTable } from "@workspace/db";
import { eq, ilike, desc } from "drizzle-orm";
import { routeIntent, detectPreference } from "../../lib/intentRouter";
import { askGemini } from "../../lib/geminiClient";
import { ProcessCommandBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/command", async (req, res): Promise<void> => {
  const parsed = ProcessCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { query } = parsed.data;
  const startTime = Date.now();

  // ── 1. Local Intent Router (fast path) ───────────────────────────────────
  const routeResult = routeIntent(query);

  if (routeResult.matched && routeResult.match) {
    const { action, reply, pattern, data } = routeResult.match;

    // Side effects for task actions
    if (action === "task_add" && data?.taskText) {
      await db.insert(tasksTable).values({ text: data.taskText });
    } else if (action === "task_complete" && data?.taskText) {
      // Find and complete matching task by text similarity
      const tasks = await db.select().from(tasksTable).where(eq(tasksTable.completed, false));
      const needle = data.taskText.toLowerCase();
      const task = tasks.find((t) => t.text.toLowerCase().includes(needle));
      if (task) {
        await db.update(tasksTable).set({ completed: true }).where(eq(tasksTable.id, task.id));
      }
    }

    // Learn platform preferences
    const pref = detectPreference(query);
    if (pref) {
      const existing = await db
        .select()
        .from(preferencesTable)
        .where(eq(preferencesTable.category, pref.category));
      const match = existing.find((p) => p.platform === pref.platform);
      if (match) {
        await db
          .update(preferencesTable)
          .set({ count: match.count + 1 })
          .where(eq(preferencesTable.id, match.id));
      } else {
        await db.insert(preferencesTable).values(pref);
      }
    }

    // Log the command
    await db.insert(commandLogsTable).values({
      query,
      source: "local_router",
      reply,
      matchedPattern: pattern,
      action,
    });

    req.log.info({ action, latencyMs: Date.now() - startTime }, "Local router matched");

    res.json({ source: "local_router", reply, query, matchedPattern: pattern, action });
    return;
  }

  // ── 2. Gemini AI Fallback (smart path) ───────────────────────────────────
  try {
    // Load top preferences for context injection
    const prefs = await db
      .select()
      .from(preferencesTable)
      .orderBy(desc(preferencesTable.count))
      .limit(5);

    const reply = await askGemini(query, prefs);

    await db.insert(commandLogsTable).values({
      query,
      source: "gemini_api",
      reply,
      matchedPattern: null,
      action: null,
    });

    req.log.info({ latencyMs: Date.now() - startTime }, "Gemini API responded");

    res.json({ source: "gemini_api", reply, query, matchedPattern: null, action: null });
  } catch (err) {
    req.log.error({ err }, "Gemini API error");
    res.status(500).json({ error: "Failed to get AI response. Please try again." });
  }
});

export default router;
