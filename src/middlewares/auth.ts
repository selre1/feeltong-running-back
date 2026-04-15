import type { RequestHandler } from "express";

export const authMiddleware: RequestHandler = (req, res, next) => {
  const sessionUser = req.session.user;

  if (!sessionUser) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  req.user = sessionUser;
  next();
};
