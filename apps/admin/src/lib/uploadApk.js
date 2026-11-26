import * as api from "./api";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Puts an APK on the server piece by piece (the server says how big a piece is), so a 100 MB file never needs a bigger request limit in
 * nginx or Cloudflare. A piece that fails because the connection dropped (or the server had a hiccup) is tried again up to 4 times with a
 * growing pause; a refusal (4xx) stops at once because trying again can't change it.
 *
 * @param {File} file
 * @param {{ onProgress?: (info: { sent: number, total: number, piece: number, pieces: number }) => void, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ uploadId: string }>} ready to be completed with `completeAppUpload`
 */
export async function uploadApk(file, { onProgress, signal, app = "oma" } = {}) {
  const started = await api.startAppUpload(file.name, file.size, app);
  const { uploadId, chunkSize, chunks } = started;
  let done = 0; // bytes of whole pieces already on the server
  for (let i = 0; i < chunks; i += 1) {
    const blob = file.slice(i * chunkSize, Math.min(file.size, (i + 1) * chunkSize));
    for (let attempt = 1; ; attempt += 1) {
      try {
        await api.putAppChunk(uploadId, i, blob, {
          signal,
          onBytes: (n) => onProgress?.({ sent: done + n, total: file.size, piece: i + 1, pieces: chunks }),
        });
        break;
      } catch (e) {
        if (e?.name === "AbortError") throw e;
        const refused = typeof e?.status === "number" && e.status >= 400 && e.status < 500;
        if (refused || attempt >= 4) throw e;
        await wait(800 * attempt);
      }
    }
    done += blob.size;
    onProgress?.({ sent: done, total: file.size, piece: i + 1, pieces: chunks });
  }
  return { uploadId };
}

/** "v-26.11.27-003" out of a file name such as "rasoi-pulse-oma-v-26.11.27-003.apk" (or ""), to pre-fill the version box. */
export const versionFromFileName = (name) => /v-\d{2}\.\d{2}\.\d{2}-\d{3,}/i.exec(String(name ?? ""))?.[0]?.toLowerCase() ?? "";
