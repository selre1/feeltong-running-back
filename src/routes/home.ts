import { Router } from "express";
import { totalRecords } from "../services/home";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware);

router.get("/records", totalRecords);

export default router;
