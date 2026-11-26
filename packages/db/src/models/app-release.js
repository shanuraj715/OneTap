import mongoose from "mongoose";
import { writeEvents } from "../write-events.js";

const { Schema, model, models } = mongoose;

/**
 * A release of a mobile app (the staff app today). Platform-level, not tenant-scoped: it is Rasoi Pulse's own software, managed by the
 * platform super admin. The APK itself lives on the API server's disk (see modules/app-releases); `file.key` is its name there.
 */
const appReleaseSchema = new Schema(
  {
    app: { type: String, required: true, default: "oma", index: true },
    platform: { type: String, required: true, default: "android" },
    /** v-DDMMYY-NNN */
    version: { type: String, required: true },
    /** the build number of the version — what decides which release is newer */
    versionCode: { type: Number, required: true },
    notes: { type: String, default: "" },
    /** staff on any older version must update before they can use the app */
    force: { type: Boolean, default: false },
    status: { type: String, enum: ["draft", "published", "withdrawn"], default: "draft", index: true },
    file: {
      /** the name it was uploaded with */
      name: { type: String, default: "" },
      /** the name it is stored under */
      key: { type: String, default: "" },
      size: { type: Number, default: 0 },
      sha256: { type: String, default: "" },
    },
    downloads: { type: Number, default: 0 },
    publishedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

appReleaseSchema.index({ app: 1, platform: 1, versionCode: 1 }, { unique: true });
appReleaseSchema.plugin(writeEvents, { model: "AppRelease", ignore: ["downloads"] });
export const AppReleaseModel = models.AppRelease ?? model("AppRelease", appReleaseSchema);

/**
 * Settings of one app (not of one release), set by the platform admin: today how often the app asks the server for new data. One document per
 * app; an app with no document uses the default (APP_REFRESH.default). Platform-level, not tenant-scoped.
 */
const appSettingSchema = new Schema(
  {
    app: { type: String, required: true, unique: true },
    refreshSeconds: { type: Number, required: true },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);
export const AppSettingModel = models.AppSetting ?? model("AppSetting", appSettingSchema);
