import { Router } from "express";
import { login, logout, session, signUp, withdraw } from "../services/auth";
import { authMiddleware } from "@/middlewares/auth";
import { createWsToken } from "@/modules/wsTokenStore";

const router = Router();

router.post("/login", login);
router.post("/signup", signUp);
router.get("/session", session);
router.post("/logout", logout);
router.delete("/withdraw", authMiddleware, withdraw);

router.post("/ws-token", authMiddleware, (req, res) => {
  const token = createWsToken(req.user!.id, req.user!.nickname);
  res.json({ token });
});

export default router;
