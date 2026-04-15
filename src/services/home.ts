import type { RequestHandler } from "express";
import { runRecordModel } from "../modules/stores/mongo";

export const totalRecords: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const records = await runRecordModel.find({ userId }).sort({ startedAt: -1 }).lean();

    return res.status(200).json({ records });

  } catch (error) {
    return res.status(500).send({ message: "[home/totalRecords] internal server error" });
  }
}
