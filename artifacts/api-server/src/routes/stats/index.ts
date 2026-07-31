import { Router, type IRouter } from "express";
import { eq, count, sql } from "drizzle-orm";
import { db, tasksTable, commandLogsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [totalCmds] = await db.select({ count: count() }).from(commandLogsTable);
  const [localCmds] = await db
    .select({ count: count() })
    .from(commandLogsTable)
    .where(eq(commandLogsTable.source, "local_router"));
  const [geminiCmds] = await db
    .select({ count: count() })
    .from(commandLogsTable)
    .where(eq(commandLogsTable.source, "gemini_api"));

  const [totalTasks] = await db.select({ count: count() }).from(tasksTable);
  const [completedTasks] = await db
    .select({ count: count() })
    .from(tasksTable)
    .where(eq(tasksTable.completed, true));

  // Top action categories
  const topCategories = await db
    .select({
      category: commandLogsTable.action,
      count: count(),
    })
    .from(commandLogsTable)
    .where(sql`${commandLogsTable.action} IS NOT NULL`)
    .groupBy(commandLogsTable.action)
    .orderBy(sql`count(*) DESC`)
    .limit(5);

  res.json({
    totalCommands: totalCmds?.count ?? 0,
    localCommands: localCmds?.count ?? 0,
    geminiCommands: geminiCmds?.count ?? 0,
    tasksTotal: totalTasks?.count ?? 0,
    tasksCompleted: completedTasks?.count ?? 0,
    topCategories: topCategories.map((r) => ({
      category: r.category ?? "unknown",
      count: r.count,
    })),
  });
});

export default router;
