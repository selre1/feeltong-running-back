import type { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "../loadenv";

const authPayloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signUpPayloadSchema = authPayloadSchema.extend({
  nickname: z.string().min(1),
});

const supabaseClient = createClient(supabase.url, supabase.anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

type SupabaseAuthUser = {
  email?: string | null;
  id: string;
  user_metadata?: {
    nickname?: string;
    nikename?: string;
  };
};

const getNickname = (user: SupabaseAuthUser, fallback: string) => {
  return user.user_metadata?.nickname ?? user.user_metadata?.nikename ?? fallback;
};

const buildUser = (user: SupabaseAuthUser, fallbackNickname = "test") => ({
  id: user.id,
  email: user.email ?? "",
  nickname: getNickname(user, fallbackNickname),
});

export const login: RequestHandler = async (req, res) => {
  const parsed = authPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    res.status(401).json({ message: error?.message ?? "Login failed" });
    return;
  }

  const user = buildUser(data.user);
  req.session.user = user;

  res.status(200).json({ user });
};

export const signUp: RequestHandler = async (req, res) => {
  const parsed = signUpPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        nickname: parsed.data.nickname,
      },
    },
  });

  if (error || !data.user) {
    res.status(400).json({ message: error?.message ?? "Signup failed" });
    return;
  }

  const user = buildUser(data.user, parsed.data.nickname);
  req.session.user = user;

  res.status(201).json({ user });
};

export const session: RequestHandler = async (req, res) => {
  const user = req.session.user;
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  res.status(200).json({ user });
};

export const logout: RequestHandler = async (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      res.status(500).json({ message: "Logout failed" });
      return;
    }

    res.clearCookie("running.sid");
    res.status(200).json({ ok: true });
  });
};
