import cors from "cors";
import { corsWhiteList } from "../loadenv";

export const corsMiddleware = cors({
  origin: corsWhiteList,
  credentials: true,
});
