import crypto from "crypto";

type TokenEntry = {
  userId: string;
  nickname: string;
  expiresAt: number;
};

const store = new Map<string, TokenEntry>();
const TTL_MS = 30_000;

export function createWsToken(userId: string, nickname: string): string {
  const token = crypto.randomUUID();
  store.set(token, { userId, nickname, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function consumeWsToken(token: string): { userId: string; nickname: string } | null {
  const entry = store.get(token);
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(token);
    return null;
  }
  store.delete(token);
  return { userId: entry.userId, nickname: entry.nickname };
}
