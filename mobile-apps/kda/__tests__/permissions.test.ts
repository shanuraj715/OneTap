import fs from "node:fs";
import path from "node:path";
import * as S from "@/api/schemas";
import { canSwitchDishes, isKitchenManager, roleTitle } from "@/auth/permissions";

const login = (n: string) => S.appLoginSchema.parse(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", `${n}.json`), "utf8")));
const cook = login("auth-app-login").user, boss = login("auth-app-login-manager").user, admin = login("auth-app-login-super").user;

describe("what each role may do in the app (the buttons only follow what the server allows)", () => {
  it("kitchen staff switch dishes but do not set stock numbers or see the day's numbers", () => {
    expect(canSwitchDishes(cook)).toBe(true);
    expect(isKitchenManager(cook)).toBe(false);
  });
  it("the kitchen manager does both", () => { expect(canSwitchDishes(boss)).toBe(true); expect(isKitchenManager(boss)).toBe(true); });
  it("the platform admin does both", () => { expect(canSwitchDishes(admin)).toBe(true); expect(isKitchenManager(admin)).toBe(true); });
  it("nobody signed in may do nothing", () => { expect(canSwitchDishes(null)).toBe(false); expect(isKitchenManager(null)).toBe(false); });
  it("a person who may only LOOK at the dishes sees no switch", () => expect(canSwitchDishes({ ...cook, permissions: cook.permissions.filter((p) => p !== "menu:availability") })).toBe(false));
  it("roles in the words a kitchen uses", () => {
    expect(roleTitle(cook)).toBe("Kitchen staff");
    expect(roleTitle(boss)).toBe("Kitchen manager");
    expect(roleTitle(admin)).toBe("Platform admin");
    expect(roleTitle({ ...cook, role: "owner" })).toBe("Owner");
    expect(roleTitle(null)).toBe("");
  });
});
