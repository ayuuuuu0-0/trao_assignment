import mongoose, { Schema, Document } from "mongoose";

export interface IPracticeRecord extends Document {
  userId: string;
  kitId: string;
  cardId: string;
  confidence: number;
  writtenAnswer?: string;
  seenCount: number;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeSchema = new Schema<IPracticeRecord>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    kitId: {
      type: String,
      required: true,
      index: true,
    },
    cardId: {
      type: String,
      required: true,
      index: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    writtenAnswer: {
      type: String,
      default: "",
    },
    seenCount: {
      type: Number,
      default: 1,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

PracticeSchema.index({ userId: 1, kitId: 1, cardId: 1 }, { unique: true });

export const PracticeModel =
  mongoose.models.Practice || mongoose.model<IPracticeRecord>("Practice", PracticeSchema);
