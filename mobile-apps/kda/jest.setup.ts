// Shared test setup: the phone's secure storage and network-status modules do not exist in Node, so each gets a small in-memory stand-in.
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
    __store: store,
  };
});

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => () => undefined), fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })) },
  useNetInfo: () => ({ isConnected: true, isInternetReachable: true }),
}));

// the phone's preference storage: the library's own in-memory stand-in
jest.mock("@react-native-async-storage/async-storage", () => jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"));

jest.mock("expo-system-ui", () => ({ setBackgroundColorAsync: jest.fn().mockResolvedValue(true), getBackgroundColorAsync: jest.fn().mockResolvedValue(null) }));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { name: "Rasoi Pulse KDA", version: "v-26.11.26-001", extra: { apiUrl: "https://api.example.test" } } },
}));

// Safe-area insets come from the phone's window; in Node they are zero.
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
