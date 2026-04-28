import type { RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "../loadenv";
import { runRecordModel, meetingRoomModel, chatMessageModel } from "../modules/stores/mongo";

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

const supabaseAdminClient = supabase.serviceRoleKey
  ? createClient(supabase.url, supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

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
    res.status(200).json({ user: null });
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

export const withdraw: RequestHandler = async (req, res) => {
  if (!supabaseAdminClient) {
    res.status(500).json({ message: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY missing" });
    return;
  }

  const userId = req.user!.id;

  try {
    // 러닝 기록 삭제
    await runRecordModel.deleteMany({ userId });

    // 내가 만든 방의 채팅 메시지 삭제 후 방 삭제
    const createdRooms = await meetingRoomModel.find({ creatorId: userId }, "_id");
    if (createdRooms.length > 0) {
      const createdRoomIds = createdRooms.map((r) => r._id);
      await chatMessageModel.deleteMany({ roomId: { $in: createdRoomIds } });
      await meetingRoomModel.deleteMany({ creatorId: userId });
    }

    // 참여 중인 다른 방에서 멤버 제거
    await meetingRoomModel.updateMany(
      { "members.userId": userId },
      { $pull: { members: { userId } } },
    );

    // 내가 보낸 채팅 메시지 삭제
    await chatMessageModel.deleteMany({ senderId: userId });

    // Supabase auth 계정 삭제
    const { error } = await supabaseAdminClient.auth.admin.deleteUser(userId);
    if (error) {
      res.status(500).json({ message: error.message });
      return;
    }
  } catch {
    res.status(500).json({ message: "Withdrawal failed" });
    return;
  }

  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ message: "Session cleanup failed" });
      return;
    }
    res.clearCookie("running.sid");
    res.status(200).json({ ok: true });
  });
};
