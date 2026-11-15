import { useCallback, useState } from "react";
import * as api from "./api";
import { prepareImage } from "./prepareImage";

/* ---------------------------------------------------------------- uploads */

/**
 * Upload one or more image files of any format. Huge photos are trimmed in the
 * browser first; the API does the actual compression and re-encoding and
 * returns the stored { url, key, width, height } records.
 */
export function useImageUpload(outlet, { kind = "menu-items" } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const upload = useCallback(
    async (files) => {
      const list = Array.from(files ?? []);
      if (!list.length || !outlet) return [];
      setBusy(true);
      setError(null);
      try {
        const out = [];
        for (const file of list) {
          const { blob } = await prepareImage(file);
          const stored = await api.uploadImage(outlet, blob, kind);
          out.push(stored);
        }
        return out;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [outlet, kind],
  );

  return { upload, busy, error, clearError: () => setError(null) };
}
