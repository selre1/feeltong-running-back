import { supabase } from "../../loadenv";

export type AuthTokenPayload = {
  sub?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
};

const parseBearerToken = (authorization?: string): string | null => {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
};

export const verifyAccessToken = async (
  authorization?: string
): Promise<AuthTokenPayload> => {
  const token = parseBearerToken(authorization);
  if (!token) {
    throw new Error("MISSING_BEARER_TOKEN");
  }

  const { createRemoteJWKSet, jwtVerify } = await import("jose");
  const jwks = createRemoteJWKSet(new URL(supabase.jwksUrl));

  const { payload } = await jwtVerify(token, jwks, {
    issuer: supabase.issuer,
  });

  if (!payload.sub) {
    throw new Error("INVALID_SUB");
  }

  return payload;
};
