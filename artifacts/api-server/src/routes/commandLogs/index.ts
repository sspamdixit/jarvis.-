import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, commandLogsTable } from "@workspace/db";
import { ListCommandLogsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/command-logs", async (req, res): Promise<void> => {
  const query = ListCommandLogsQueryParams.safeParse(req.query);
  const limit = query.success ? Math.min(Math.round(query.data.limit ?? 20), 100) : 20;

  const logs = await db
    .select()
    .from(commandLogsTable)
    .orderBy(desc(commandLogsTable.createdAt))
    .limit(limit);

  res.json(logs);
});

export default router;
