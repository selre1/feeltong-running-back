import dotenv from "dotenv";

const nodeEnv = process.env.NODE_ENV;
dotenv.config({ path: `.env.${nodeEnv}` });

if (!process.env.DB_PATH) {
  throw new Error("DB_PATH is required");
}
if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL is required");
}
if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY is required");
}
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required");
}

const rawCors = process.env.CORS_WHITELIST || '["http://localhost:3000"]';
let corsWhiteList: string[] = [];
try {
  corsWhiteList = JSON.parse(rawCors);
} catch {
  throw new Error("CORS_WHITELIST must be a JSON array string");
}

export { nodeEnv, corsWhiteList };
export const port = Number(process.env.PORT);
export const mongoUrl = process.env.DB_PATH;
export const sessionSecret = process.env.SESSION_SECRET;
export const supabase = {
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  issuer: `${process.env.SUPABASE_URL}/auth/v1`,
  // Backward compatibility for an easy typo.
  jwksUrl:
    process.env.SUPABASE_JWKS_URL?.trim() ||
    `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
};
