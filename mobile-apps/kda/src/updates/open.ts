import { Linking } from "react-native";

/**
 * Opens the app's download page in the phone's own browser (Chrome, or whatever the person uses), where the file can be downloaded and
 * installed. Only web addresses are opened: whatever the server sends, it can't make the app open something else (a phone call, an app link).
 * Returns false when it could not be opened.
 */
export async function openUpdatePage(url: string | null | undefined): Promise<boolean> {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
