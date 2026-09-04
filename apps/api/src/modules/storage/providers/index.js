import { localProvider } from "./local.js";
import { s3Provider } from "./s3.js";

/** The adapter registry. Adding a backend is a new file plus one entry here. */
export const STORAGE_PROVIDERS_IMPL = {
  local: localProvider,
  s3: s3Provider,
};

/** @param {import("@onetap/config-schema").StorageProvider} provider */
export const providerFor = (provider) => STORAGE_PROVIDERS_IMPL[provider] ?? localProvider;

export * from "./types.js";
export { localUploadsPath } from "./local.js";
