import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { listRecords, saveRecord } from "../services/record";

const router = Router();

router.use(authMiddleware);
router.get("/", listRecords);
router.post("/save", saveRecord);

export default router;
