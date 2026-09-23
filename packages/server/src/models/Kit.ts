import mongoose, { Schema, Document } from "mongoose";
import { Kit } from "@prepkit/core";

export interface IKitDocument extends Document {
  userId: string;
  status: "generating" | "ready" | "partial" | "failed";
  hash: string;
  version: number;
  kitData: Kit;
  history: Array<{
    timestamp: Date;
    section: string;
    snapshot: any;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const KitDocumentSchema = new Schema<IKitDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["generating", "ready", "partial", "failed"],
      default: "generating",
      index: true,
    },
    hash: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    kitData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    history: [
      {
        timestamp: { type: Date, default: Date.now },
        section: { type: String, required: true },
        snapshot: { type: Schema.Types.Mixed, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for user duplicate detection
KitDocumentSchema.index({ userId: 1, hash: 1 });

export const KitModel = mongoose.models.Kit || mongoose.model<IKitDocument>("Kit", KitDocumentSchema);
