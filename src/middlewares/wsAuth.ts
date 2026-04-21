import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { consumeWsToken } from "@/modules/wsTokenStore";

export interface AuthenticatedWS extends WebSocket {
  userId: string;
  nickname: string;
  roomId: string;
}

export function registerWsUpgrade(server: Server, wss: WebSocketServer): void {
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const match = url.pathname.match(/^\/ws\/rooms\/([^/?]+)/);
    if (!match) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const roomId = match[1];
    const token = url.searchParams.get("token") ?? "";
    const user = consumeWsToken(token);

    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const authWS = ws as AuthenticatedWS;
      authWS.userId = user.userId;
      authWS.nickname = user.nickname;
      authWS.roomId = roomId;
      wss.emit("connection", authWS);
    });
  });
}
