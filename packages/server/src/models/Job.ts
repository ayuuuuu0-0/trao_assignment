import mongoose, { Schema, Document } from "mongoose";

export interface IJobStep {
  name: string;
  status: "pending" | "running" | "done" | "skipped" | "failed";
  startedAt?: Date;
  finishedAt?: Date;
  detail?: string;
}

export interface IJobDocument extends Document {
  jobId: string;
  userId: string;
  kitId: string;
  status: "queued" | "running" | "succeeded" | "partial" | "failed" | "interrupted";
  steps: IJobStep[];
  pages: Array<{
    url: string;
    kind: string;
    status: string;
    reason?: string | null;
  }>;
  sources: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  traces: any[];
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJobDocument>(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
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
    status: {
      type: String,
      enum: ["queued", "running", "succeeded", "partial", "failed", "interrupted"],
      default: "queued",
      index: true,
    },
    steps: [
      {
        name: { type: String, required: true },
        status: {
          type: String,
          enum: ["pending", "running", "done", "skipped", "failed"],
          default: "pending",
        },
        startedAt: { type: Date },
        finishedAt: { type: Date },
        detail: { type: String },
      },
    ],
    pages: [
      {
        url: { type: String, required: true },
        kind: { type: String, default: "other" },
        status: { type: String, default: "fetched" },
        reason: { type: String },
      },
    ],
    sources: [
      {
        title: { type: String },
        url: { type: String },
        snippet: { type: String },
      },
    ],
    traces: {
      type: Schema.Types.Mixed,
      default: [],
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const JobModel = mongoose.models.Job || mongoose.model<IJobDocument>("Job", JobSchema);
