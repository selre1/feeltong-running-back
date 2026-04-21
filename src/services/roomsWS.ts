import { WebSocketServer } from "ws";
import { Types } from "mongoose";
import { chatMessageModel, meetingRoomModel } from "@/modules/stores/mongo";
import type { AuthenticatedWS } from "@/middlewares/wsAuth";

const HISTORY_LIMIT = 30;

type RoomClients = Set<AuthenticatedWS>;
const roomClientMap = new Map<string, RoomClients>();

function getClients(roomId: string): RoomClients {
  if (!roomClientMap.has(roomId)) roomClientMap.set(roomId, new Set());
  return roomClientMap.get(roomId)!;
}

function broadcast(clients: RoomClients, data: object): void {
  const payload = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(payload);
  });
}

function broadcastExcept(clients: RoomClients, exclude: AuthenticatedWS, data: object): void {
  const payload = JSON.stringify(data);
  clients.forEach((client) => {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  });
}

async function getMemberCount(roomId: string): Promise<number> {
  try {
    const room = await meetingRoomModel.findById(roomId).select("members").lean();
    return room?.members.length ?? 0;
  } catch {
    return 0;
  }
}

async function sendHistory(ws: AuthenticatedWS): Promise<void> {
  try {
    const messages = await chatMessageModel
      .find({ roomId: new Types.ObjectId(ws.roomId) })
      .sort({ sentAt: -1 })
      .limit(HISTORY_LIMIT + 1)
      .lean();

    const hasMore = messages.length > HISTORY_LIMIT;
    const slice = messages.slice(0, HISTORY_LIMIT);

    ws.send(
      JSON.stringify({
        type: "history",
        data: slice.reverse().map((m) => ({
          id: m._id.toString(),
          senderId: m.senderId,
          senderNickname: m.senderNickname,
          content: m.content,
          sentAt: (m.sentAt as Date).getTime(),
        })),
        hasMore,
      }),
    );
  } catch {
    ws.send(JSON.stringify({ type: "history", data: [], hasMore: false }));
  }
}

async function handleMessage(
  ws: AuthenticatedWS,
  clients: RoomClients,
  raw: Buffer,
): Promise<void> {
  try {
    const msg = JSON.parse(raw.toString());

    if (msg.type === "typing") {
      broadcastExcept(clients, ws, {
        type: "typing",
        senderId: ws.userId,
        senderNickname: ws.nickname,
      });
      return;
    }

    if (msg.type !== "send_message" || typeof msg.content !== "string") return;

    const content = msg.content.trim();
    if (!content) return;

    const sentAt = new Date();
    const saved = await chatMessageModel.create({
      roomId: new Types.ObjectId(ws.roomId),
      senderId: ws.userId,
      senderNickname: ws.nickname,
      content,
      sentAt,
    });

    broadcast(clients, {
      type: "message",
      data: {
        id: saved._id.toString(),
        senderId: ws.userId,
        senderNickname: ws.nickname,
        content,
        sentAt: sentAt.getTime(),
      },
    });
  } catch {
    // malformed message, ignore
  }
}

export function setupRoomsWSHandlers(wss: WebSocketServer): void {
  wss.on("connection", async (ws: AuthenticatedWS) => {
    const { roomId, userId, nickname } = ws;
    const clients = getClients(roomId);
    clients.add(ws);

    await sendHistory(ws);

    const joinedCount = await getMemberCount(roomId);
    broadcast(clients, { type: "user_joined", data: { userId, nickname, memberCount: joinedCount } });
    broadcast(clients, { type: "online_count", count: clients.size });

    ws.on("message", (raw) => handleMessage(ws, clients, raw as Buffer));

    ws.on("close", async () => {
      clients.delete(ws);
      if (clients.size === 0) roomClientMap.delete(roomId);

      const leftCount = await getMemberCount(roomId);
      broadcast(clients, { type: "user_left", data: { userId, nickname, memberCount: leftCount } });
      broadcast(clients, { type: "online_count", count: clients.size });
    });
  });
}
