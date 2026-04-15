import mongoose, { model, Schema, Types } from "mongoose";

type InferSchemaType<T> = mongoose.InferSchemaType<T> & {
  _id: Types.ObjectId;
};

const runRecordSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    distanceMeters: { type: Number, required: true, min: 0 },
    durationSeconds: { type: Number, required: true, min: 0 },
    paceSecondsPerKm: { type: Number, required: true, min: 0 },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    route: {
      type: [
        {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
          timestamp: { type: Number, required: true },
        },
      ],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const runRecordModel = model("RunRecord", runRecordSchema);
export type RunRecord = InferSchemaType<typeof runRecordSchema>;

mongoose.set("strictQuery", true);
const database = mongoose.connection;

export const connectDatabase = (mongoUri: string) => {
  database.on("error", (err) => {
    console.error("MongoDB connection error:", err);
    setTimeout(() => {
      mongoose.connect(mongoUri).catch((connectErr) => {
        console.error("MongoDB reconnection error:", connectErr);
      });
    }, 5000);
  });

  mongoose.connect(mongoUri);

  return database;
};