import express from "express";
import http from "http";
import { mongoUrl, port } from "./loadenv";
import { authMiddleware } from "./middlewares/auth";
import { corsMiddleware } from "./middlewares/cors";
import { connectDatabase } from "./modules/stores/mongo";
import { sessionMiddleware } from "./middlewares/session";
import { authRouter, homeRouter, runsRouter } from "./routes";

connectDatabase(mongoUrl);

const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(corsMiddleware);
app.use(sessionMiddleware);

app.use("/auth", authRouter);
app.use("/home", homeRouter);
app.use("/runs", runsRouter);

app.get("/logininfo", authMiddleware, (req, res) => {
  res.status(200).json(req.user);
});

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

const serverHttp = http.createServer(app).listen(port, () => {
  console.log(`[Feeltong-running-back] server started on port ${port}`);
});
