import { Types } from "mongoose";
import { chatMessageModel, meetingRoomModel } from "@/modules/stores/mongo";

const MESSAGE_DEFAULT_LIMIT = 30;

type RoomDTO = {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorNickname: string;
  memberCount: number;
  createdAt: number;
  isJoined: boolean;
};

function toDTO(room: any, userId: string): RoomDTO {
  return {
    id: room._id.toString(),
    name: room.name,
    description: room.description,
    creatorId: room.creatorId,
    creatorNickname: room.creatorNickname,
    memberCount: room.members.length,
    createdAt: new Date(room.createdAt).getTime(),
    isJoined: room.members.some((m: any) => m.userId === userId),
  };
}

export async function getAllRooms(userId: string): Promise<RoomDTO[]> {
  const rooms = await meetingRoomModel.find().sort({ createdAt: -1 }).lean();
  return rooms.map((r) => toDTO(r, userId));
}

export async function createRoom(
  userId: string,
  nickname: string,
  data: { name: string; description: string },
): Promise<RoomDTO> {
  const room = await meetingRoomModel.create({
    name: data.name,
    description: data.description,
    creatorId: userId,
    creatorNickname: nickname,
    members: [{ userId, nickname }],
  });
  return toDTO(room.toObject(), userId);
}

export async function updateRoom(
  roomId: string,
  userId: string,
  data: { name?: string; description?: string },
): Promise<RoomDTO> {
  const room = await meetingRoomModel.findById(roomId);
  if (!room) throw { status: 404, message: "Room not found" };
  if (room.creatorId !== userId) throw { status: 403, message: "Forbidden" };

  if (data.name !== undefined) room.name = data.name;
  if (data.description !== undefined) room.description = data.description;
  await room.save();

  return toDTO(room.toObject(), userId);
}

export async function deleteRoom(roomId: string, userId: string): Promise<void> {
  const room = await meetingRoomModel.findById(roomId);
  if (!room) throw { status: 404, message: "Room not found" };
  if (room.creatorId !== userId) throw { status: 403, message: "Forbidden" };

  await meetingRoomModel.deleteOne({ _id: roomId });
  await chatMessageModel.deleteMany({ roomId: new Types.ObjectId(roomId) });
}

export async function joinRoom(
  roomId: string,
  userId: string,
  nickname: string,
): Promise<{ memberCount: number }> {
  const room = await meetingRoomModel.findById(roomId);
  if (!room) throw { status: 404, message: "Room not found" };

  if (!room.members.some((m) => m.userId === userId)) {
    room.members.push({ userId, nickname });
    await room.save();
  }

  return { memberCount: room.members.length };
}

export async function leaveRoom(
  roomId: string,
  userId: string,
): Promise<{ memberCount: number }> {
  const room = await meetingRoomModel.findById(roomId);
  if (!room) throw { status: 404, message: "Room not found" };

  room.members = room.members.filter((m) => m.userId !== userId) as any;
  await room.save();

  return { memberCount: room.members.length };
}

export async function getRoom(roomId: string, userId: string): Promise<RoomDTO> {
  const room = await meetingRoomModel.findById(roomId).lean();
  if (!room) throw { status: 404, message: "Room not found" };
  return toDTO(room, userId);
}

type ChatMessageDTO = {
  id: string;
  senderId: string;
  senderNickname: string;
  content: string;
  sentAt: number;
};

export async function getMessages(
  roomId: string,
  beforeId: string | undefined,
  limit: number,
): Promise<{ data: ChatMessageDTO[]; hasMore: boolean }> {
  const query: any = { roomId: new Types.ObjectId(roomId) };
  if (beforeId) {
    query._id = { $lt: new Types.ObjectId(beforeId) };
  }

  const messages = await chatMessageModel
    .find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = messages.length > limit;
  const slice = messages.slice(0, limit);

  return {
    data: slice.reverse().map((m) => ({
      id: m._id.toString(),
      senderId: m.senderId,
      senderNickname: m.senderNickname,
      content: m.content,
      sentAt: (m.sentAt as Date).getTime(),
    })),
    hasMore,
  };
}
