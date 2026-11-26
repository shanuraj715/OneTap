import { ApiError } from "@/api/client";
import { describeSignInError, phoneDigits, signInProblems } from "@/features/signin";

describe("what is checked before the PIN is sent", () => {
  it("a number and a PIN are needed", () => {
    expect(signInProblems("", "")).toEqual({ phone: "Enter your mobile number.", pin: "Enter your PIN." });
    expect(signInProblems("98765", "4821")).toEqual({ phone: "Enter your 10-digit mobile number." });
    expect(signInProblems("9876543210", "12")).toEqual({ pin: "Your PIN is 4 to 6 digits." });
    expect(signInProblems("9876543210", "12a4")).toEqual({ pin: "Your PIN is 4 to 6 digits." });
  });
  it("a good form has no problems, however the number is written", () => {
    for (const phone of ["9876543210", "98765 43210", "+91 98765 43210", "098765-43210"]) expect(signInProblems(phone, "4821")).toEqual({});
    expect(signInProblems("9876543210", "123456")).toEqual({});
  });
  it("the number is its last 10 digits", () => { expect(phoneDigits("+91 98765 43210")).toBe("9876543210"); expect(phoneDigits("123")).toBe(""); });
});

describe("what the rider is told when sign-in fails", () => {
  it("a wrong PIN says how many tries are left", () => {
    expect(describeSignInError(new ApiError(401, "Incorrect phone number or PIN", { details: { attemptsLeft: 4 } })).message).toBe("Incorrect phone number or PIN. 4 tries left before this number is paused.");
    expect(describeSignInError(new ApiError(401, "Incorrect phone number or PIN", { details: { attemptsLeft: 1 } })).message).toMatch(/1 try left/);
  });
  it("too many tries carries the wait", () => expect(describeSignInError(new ApiError(429, "Too many failed attempts.", { retryAfterSec: 60 }))).toEqual({ message: "Too many failed attempts.", waitSec: 60 }));
  it("a switched-off login is the server's sentence", () => expect(describeSignInError(new ApiError(403, "Your login is switched off. Ask your manager.")).message).toBe("Your login is switched off. Ask your manager."));
  it("no connection is said plainly", () => expect(describeSignInError(new ApiError(0, "Can't reach the server.")).message).toBe("Can't reach the server."));
  it("a server with no rider sign-in yet is explained, not 'Not found'", () => expect(describeSignInError(new ApiError(404, "Not found")).message).toMatch(/doesn't have the rider sign-in yet/));
  it("anything else is a calm sentence", () => expect(describeSignInError(new Error("boom")).message).toBe("Something went wrong. Please try again."));
});
