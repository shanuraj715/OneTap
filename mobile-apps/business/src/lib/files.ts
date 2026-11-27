import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/** A name that is safe to put on a phone's storage: letters, digits, dot, dash and underscore only. */
export const safeFileName = (name: string): string => {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_").replace(/_{2,}/g, "_").replace(/\.{2,}/g, ".").replace(/^\.+/, "").slice(0, 120);
  return cleaned || "report";
};

/** A saved copy of a file the server made (a report), kept in the app's own storage so it can be shared again later. */
export interface SavedFile { uri: string; name: string; size: number }

/** Write the bytes under `<stamp>-<name>` (so two reports with the same name never overwrite each other). */
export async function saveBytes(bytes: ArrayBuffer, fileName: string, stamp: number = Date.now()): Promise<SavedFile> {
  const name = safeFileName(fileName);
  const file = new File(Paths.document, `${stamp}-${name}`);
  file.create({ overwrite: true });
  await file.write(new Uint8Array(bytes));
  return { uri: file.uri, name, size: bytes.byteLength };
}

/** Remove a saved copy (an old report). A file that is already gone is not an error. */
export function deleteSaved(uri: string): void {
  try { const f = new File(uri); if (f.exists) f.delete(); } catch { /* already gone */ }
}

/** Open the phone's share sheet for a file (mail, WhatsApp, Drive, "save to files"…). false = this phone has no share sheet. */
export async function shareSaved(uri: string, mimeType: string, title = "Share report"): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title });
  return true;
}
