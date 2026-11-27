import * as LocalAuthentication from "expo-local-authentication";

/** Can this phone ask for a fingerprint, a face or the screen lock? (It needs one set up.) */
export async function lockAvailable(): Promise<boolean> {
  try { return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()); } catch { return false; }
}

/** Ask the person to prove it is them with the phone's own screen lock. true = they did. */
export async function confirmIdentity(reason: string): Promise<boolean> {
  try { return (await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: "Not now" })).success; } catch { return false; }
}
