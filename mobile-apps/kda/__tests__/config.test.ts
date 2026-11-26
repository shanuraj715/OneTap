import type { ConfigContext } from "expo/config";

/** The server address comes from EXPO_PUBLIC_API_URL when a build or `npm run phone` sets it, and falls back to the live server. */
function apiUrlWith(env: string | undefined): string {
  const before = process.env.EXPO_PUBLIC_API_URL;
  if (env === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = env;
  try {
    let url = "";
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const make = require("../app.config").default as (c: ConfigContext) => { extra?: { apiUrl?: string } };
      url = make({ config: {} } as ConfigContext).extra?.apiUrl ?? "";
    });
    return url;
  } finally {
    if (before === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = before;
  }
}

describe("which server a build talks to", () => {
  it("the live server by default", () => expect(apiUrlWith(undefined)).toBe("https://api.rasoipulse.in"));
  it("the one named in EXPO_PUBLIC_API_URL (a test server on the Mac)", () => expect(apiUrlWith("http://192.168.31.254:3097")).toBe("http://192.168.31.254:3097"));
  it("an EMPTY setting does not blank the address (it used to)", () => {
    expect(apiUrlWith("")).toBe("https://api.rasoipulse.in");
    expect(apiUrlWith("   ")).toBe("https://api.rasoipulse.in");
  });
});

describe("this app is its own app (it can be installed beside OMA)", () => {
  const make = () => {
    let cfg: Record<string, any> = {};
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cfg = (require("../app.config").default as (c: ConfigContext) => Record<string, any>)({ config: {} } as ConfigContext);
    });
    return cfg;
  };
  it("its own name, address of the app on the phone and link scheme — none of them OMA's", () => {
    const cfg = make();
    expect(cfg.name).toBe("Rasoi Pulse KDA");
    expect(cfg.android.package).toBe("com.rasoipulse.kda");
    expect(cfg.scheme).toBe("rpkda");
    expect(cfg.slug).toBe("rasoi-pulse-kda");
  });
  it("shows the version and build number of app-version.json", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const record = require("../app-version.json") as { version: string; versionCode: number };
    const cfg = make();
    expect(cfg.version).toBe(record.version);
    expect(cfg.android.versionCode).toBe(record.versionCode);
  });
  it("tells the server which app it is (the update check and the sign-in rule both depend on it)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require("@/lib/config").APP_ID).toBe("kda");
  });
});
