import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, preferencesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/preferences", async (_req, res): Promise<void> => {
  const prefs = await db
    .select()
    .from(preferencesTable)
    .orderBy(desc(preferencesTable.count));

  res.json(prefs);
});

export default router;
