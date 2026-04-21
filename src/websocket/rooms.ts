import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import { sessionMiddleware } from "@/middlewares/session";
import { chatMessageModel, meetingRoomModel } from "@/modules/stores/mongo";
import { Types } from "mongoose";

const HISTORY_LIMIT = 30;

interface AuthenticatedWS extends WebSocket {
  userId: string;
  nickname: string;
  roomId: string;
}

type RoomClients = Set<AuthenticatedWS>;
const roomClientMap = new Map<string, RoomClients>();

function getClients(roomId: string): RoomClients {
  if (!roomClientMap.has(roomId)) roomClientMap.set(roomId, new Set());
  return roomClientMap.get(roomId)!;
}

function broadcast(clients: RoomClients, data: object) {
  const payload = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

function broadcastExcept(clients: RoomClients, exclude: AuthenticatedWS, data: object) {
  const payload = JSON.stringify(data);
  clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

function resolveSession(
  req: IncomingMessage,
): Promise<{ id: string; email: string; nickname: string } | null> {
  return new Promise((resolve) => {
    const mockRes: any = {
      getHeader: () => undefined,
      setHeader: () => {},
      on: () => {},
      end: () => {},
    };
    sessionMiddleware(req as any, mockRes, () => {
      resolve((req as any).session?.user ?? null);
    });
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

export function setupRoomsWS(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    const match = req.url?.match(/^\/ws\/rooms\/([^/?]+)/);
    if (!match) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    const roomId = match[1];

    const user = await resolveSession(req);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const authWS = ws as AuthenticatedWS;
      authWS.userId = user.id;
      authWS.nickname = user.nickname;
      authWS.roomId = roomId;
      wss.emit("connection", authWS);
    });
  });

  wss.on("connection", async (ws: AuthenticatedWS) => {
    const { roomId, userId, nickname } = ws;
    const clients = getClients(roomId);
    clients.add(ws);

    // Send history (최근 30개, hasMore 포함)
    try {
      const messages = await chatMessageModel
        .find({ roomId: new Types.ObjectId(roomId) })
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

    const joinedCount = await getMemberCount(roomId);
    broadcast(clients, {
      type: "user_joined",
      data: { userId, nickname, memberCount: joinedCount },
    });

    broadcast(clients, { type: "online_count", count: clients.size });

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "typing") {
          broadcastExcept(clients, ws, {
            type: "typing",
            senderId: userId,
            senderNickname: nickname,
          });
          return;
        }

        if (msg.type !== "send_message" || typeof msg.content !== "string") return;

        const content = msg.content.trim();
        if (!content) return;

        const sentAt = new Date();
        const saved = await chatMessageModel.create({
          roomId: new Types.ObjectId(roomId),
          senderId: userId,
          senderNickname: nickname,
          content,
          sentAt,
        });

        broadcast(clients, {
          type: "message",
          data: {
            id: saved._id.toString(),
            senderId: userId,
            senderNickname: nickname,
            content,
            sentAt: sentAt.getTime(),
          },
        });
      } catch {
        // malformed message, ignore
      }
    });

    ws.on("close", async () => {
      clients.delete(ws);
      if (clients.size === 0) roomClientMap.delete(roomId);

      const leftCount = await getMemberCount(roomId);
      broadcast(clients, {
        type: "user_left",
        data: { userId, nickname, memberCount: leftCount },
      });

      broadcast(clients, { type: "online_count", count: clients.size });
    });
  });
}
