import { Router, type IRouter } from "express";
import healthRouter from "./health";
import commandRouter from "./command";
import tasksRouter from "./tasks";
import commandLogsRouter from "./commandLogs";
import preferencesRouter from "./preferences";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(commandRouter);
router.use(tasksRouter);
router.use(commandLogsRouter);
router.use(preferencesRouter);
router.use(statsRouter);

export default router;
