import expresssession from "express-session";
import { nodeEnv, sessionSecret } from "../loadenv";
import sessionStore from "@/modules/stores/sessionStore";


declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      nickname: string;
    };
  }
}

export const sessionMiddleware = expresssession({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: nodeEnv === "production" ? "none" : "lax",
    secure: nodeEnv === "production",
  },
  store: sessionStore
});