import "server-only";

import { MongoClient, type Db } from "mongodb";

const globalMongo = globalThis as typeof globalThis & {
  smartmoveMongo?: Promise<MongoClient>;
  smartmoveMongoIndexes?: Promise<void>;
};

export async function getMongoDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  const name = process.env.MONGODB_DB;
  if (!uri || !name) throw new Error("MongoDB connection is not configured");
  globalMongo.smartmoveMongo ??= new MongoClient(uri, {
    serverSelectionTimeoutMS: 3500,
  }).connect();
  let client: MongoClient;
  try {
    client = await globalMongo.smartmoveMongo;
  } catch (error) {
    globalMongo.smartmoveMongo = undefined;
    throw error;
  }
  const db = client.db(name);
  globalMongo.smartmoveMongoIndexes ??= Promise.all([
    db
      .collection("feedback_content")
      .createIndex({ feedbackId: 1 }, { unique: true }),
    db.collection("notifications").createIndex(
      { userId: 1, eventKey: 1 },
      {
        unique: true,
        partialFilterExpression: { eventKey: { $type: "string" } },
      },
    ),
    db.collection("notifications").createIndex({ userId: 1, isRead: 1 }),
    db
      .collection("announcements")
      .createIndex({ audience: 1, status: 1, publishedAt: -1 }),
  ]).then(() => undefined);
  try {
    await globalMongo.smartmoveMongoIndexes;
  } catch (error) {
    globalMongo.smartmoveMongoIndexes = undefined;
    throw error;
  }
  return db;
}

export type FeedbackContent = {
  feedbackId: string;
  bookingId?: string;
  type?: "REVIEW" | "COMPLAINT";
  comment: string;
  subject?: string;
  vehicleRating?: number;
  driverRating?: number;
  createdAt?: Date;
  reply?: { staffName: string; message: string; repliedAt?: Date };
};

export type NotificationContent = {
  userId: string;
  eventKey?: string;
  message: string;
  isRead: boolean;
  createdAt?: Date;
  href?: string;
};
