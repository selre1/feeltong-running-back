import type { RequestHandler } from "express";
import { z } from "zod";
import { runRecordModel } from "../modules/stores/mongo";

const geoPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  timestamp: z.number().int().nonnegative(),
});

const saveRecordSchema = z
  .object({
    distanceMeters: z.number().nonnegative(),
    durationSeconds: z.number().nonnegative(),
    paceSecondsPerKm: z.number().nonnegative(),
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date(),
    route: z.array(geoPointSchema).default([]),
  })
  .refine((value) => value.endedAt.getTime() >= value.startedAt.getTime(), {
    message: "endedAt must be greater than or equal to startedAt",
    path: ["endedAt"],
  });

export const saveRecord: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const parsed = saveRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid request body",
        issues: parsed.error.issues,
      });
      return;
    }

    const record = await runRecordModel.create({
      userId,
      ...parsed.data,
    });

    res.status(201).json({ record });
  } catch {
    res.status(500).json({ message: "[runs/save] internal server error" });
  }
};

export const listRecords: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const records = await runRecordModel.find({ userId }).sort({ startedAt: -1 }).lean();
    res.status(200).json(records);
  } catch {
    res.status(500).json({ message: "[runs] internal server error" });
  }
};