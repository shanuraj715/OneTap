import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IMAGE_RULES } from "@onetap/config-schema";
import * as api from "./api";
import { resizeImage } from "./resizeImage";

/* ---------------------------------------------------------------- config */

export function useStorageConfig(outlet) {
  return useQuery({
    queryKey: ["storage-config", outlet?._id],
    queryFn: () => api.getStorageConfig(outlet),
    enabled: Boolean(outlet),
  });
}

export function useSaveStorageConfig(outlet) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args) => api.saveStorageConfig(outlet, args.provider, args.values),
    onSuccess: (data) => qc.setQueryData(["storage-config", outlet?._id], data),
  });
}

export function useResetStorageConfig(outlet) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetStorageConfig(outlet),
    onSuccess: (data) => qc.setQueryData(["storage-config", outlet?._id], data),
  });
}

export function useTestStorageConfig(outlet) {
  return useMutation({ mutationFn: () => api.testStorageConfig(outlet) });
}

/* ---------------------------------------------------------------- uploads */

/**
 * Resize (in the browser) then upload one or more image files, returning the
 * stored { url, key, width, height } records ready to attach to a menu item.
 */
export function useImageUpload(outlet, { kind = "menu-items" } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const upload = useCallback(
    async (files) => {
      const list = Array.from(files ?? []).filter((f) => f && f.type.startsWith("image/"));
      if (!list.length || !outlet) return [];
      setBusy(true);
      setError(null);
      try {
        const out = [];
        for (const file of list) {
          if (!IMAGE_RULES.acceptedTypes.includes(file.type)) {
            throw new Error(`${file.name}: use a JPEG, PNG or WebP image.`);
          }
          const { blob, width, height } = await resizeImage(file, {
            maxDimension: IMAGE_RULES.maxDimension,
          });
          const stored = await api.uploadImage(outlet, blob, { width, height }, kind);
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
