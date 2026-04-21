import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/middlewares/auth";
import * as roomService from "@/services/rooms";

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

router.get("/", async (req, res) => {
  try {
    res.json(await roomService.getAllRooms(req.user!.id));
  } catch (e: any) {
    res.status(e.status ?? 500).json({ message: e.message });
  }
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ issues: parsed.error.issues });
    return;
  }
  try {
    res.status(201).json(
      await roomService.createRoom(req.user!.id, req.user!.nickname, parsed.data),
    );
  } catch (e: any) {
    res.status(e.status ?? 500).json({ message: e.message });
  }
});

router.patch("/:roomId", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ issues: parsed.error.issues });
    return;
  }
  try {
    res.json(
      await roomService.updateRoom(req.params.roomId, req.user!.id, parsed.data),
    );
  } catch (e: any) {
    res.status(e.status ?? 500).json({ message: e.message });
  }
});

router.delete("/:roomId", async (req, res) => {
  try {
    await roomService.deleteRoom(req.params.roomId, req.user!.id);
    res.status(204).send();
  } catch (e: any) {
    res.status(e.status ?? 500).json({ message: e.message });
  }
});

router.get("/:roomId", async (req, res) => {
  try {
    res.json(await roomService.getRoom(req.params.roomId, req.user!.id));
  } catch (e: any) {
    res.status(e.status ?? 500).json({ message: e.message });
  }
});

router.get("/:roomId/messages", async (req, res) => {
  const beforeId = typeof req.query.before_id === "string" ? req.query.before_id : undefined;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  try {
    res.json(await roomService.getMessages(req.params.roomId, beforeId, limit));
  } catch (e: any) {
    res.status(e.status ?? 500).json({ message: e.message });
  }
});

router.post("/:roomId/join", async (req, res) => {
  try {
    res.json(await roomService.joinRoom(req.params.roomId, req.user!.id, req.user!.nickname));
  } catch (e: any) {
    res.status(e.status ?? 500).json({ message: e.message });
  }
});

router.post("/:roomId/leave", async (req, res) => {
  try {
    res.json(await roomService.leaveRoom(req.params.roomId, req.user!.id));
  } catch (e: any) {
    res.status(e.status ?? 500).json({ message: e.message });
  }
});

export default router;
