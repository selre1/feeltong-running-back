import { Router } from "express";
import { login, logout, session, signUp } from "../services/auth";

const router = Router();

router.post("/login", login);
router.post("/signup", signUp);
router.get("/session", session);
router.post("/logout", logout);

export default router;
