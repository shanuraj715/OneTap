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
 * Settings of one app (not of one release), set by the platform admin: how often the app asks the server for new data, and whether it is listed publicly on the website. One document per
 * app; an app with no document uses the default (APP_REFRESH.default). Platform-level, not tenant-scoped.
 */
const appSettingSchema = new Schema(
  {
    app: { type: String, required: true, unique: true },
    refreshSeconds: { type: Number, required: true },
    /** shown in the website's public list of apps? null = the app's own default (`listed` in the catalog); true = public; false = private */
    isPublic: { type: Boolean, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);
export const AppSettingModel = models.AppSetting ?? model("AppSetting", appSettingSchema);

/**
 * An app of Rasoi Pulse (OMA, KDA, … and any the platform admin adds in App Management): its name, the short code on its icon, the words on its page and
 * whether it is PUBLIC (in the website's list of apps) or private (not listed; its page still opens for anyone with the link). The built-in apps are put here
 * the first time the registry is read, from the defaults in config-schema (`APP_CATALOG`); after that the console owns them. Platform-level, not tenant-scoped.
 */
const appSchema = new Schema(
  {
    /** the app's id: what the app sends as `x-app-id`, what its releases are filed under, and the address of its page (/apps/<slug>) */
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    tagline: { type: String, default: "" },
    audience: { type: String, default: "" },
    description: { type: String, default: "" },
    isPublic: { type: Boolean, default: false },
    /** the app asks the server for new data by the console's "Refresh interval" number (the staff apps) */
    usesRefreshInterval: { type: Boolean, default: false },
    /** how the app that can listen gets new data: "websocket" = the live connection first (polling stays as the backup), "polling" = no live connection */
    liveMode: { type: String, enum: ["websocket", "polling"], default: "websocket" },
    /** one of the apps that ship with Rasoi Pulse: their sign-in rules live in the code, so they cannot be deleted */
    builtIn: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 100 },
    /** the "See it" screenshots section of the app's page: shown or not, its words ("" = the usual ones), the device shown first, and whether the built-in pictures were copied in yet */
    shotsEnabled: { type: Boolean, default: true },
    shotsHeading: { type: String, default: "" },
    shotsIntro: { type: String, default: "" },
    shotsDefaultDevice: { type: String, enum: ["tablet-landscape", "tablet-portrait", "phone"], default: "tablet-landscape" },
    shotsSeeded: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);
export const AppModel = models.App ?? model("App", appSchema);

/**
 * One screenshot of an app on its website page: a screen (title, a few words, a description for screen readers) with up to six pictures —
 * `images[device][theme] = { src, key, width, height }` for the devices tablet-landscape / tablet-portrait / phone and the themes light / dark.
 * `src` is a path on the website ("/app-screens/…", the ones that ship with it) or an uploaded file ("/uploads/…", `key` says where it is stored so it can be removed).
 * `builtInName` marks the ones copied in from the pictures that ship with the website (so copying twice makes no duplicates). Platform-level.
 */
const appShotSchema = new Schema(
  {
    app: { type: String, required: true, index: true },
    title: { type: String, required: true },
    caption: { type: String, default: "" },
    alt: { type: String, default: "" },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    builtInName: { type: String, default: null },
    images: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, minimize: false },
);
appShotSchema.index({ app: 1, builtInName: 1 }, { unique: true, partialFilterExpression: { builtInName: { $type: "string" } } });
export const AppShotModel = models.AppShot ?? model("AppShot", appShotSchema);
