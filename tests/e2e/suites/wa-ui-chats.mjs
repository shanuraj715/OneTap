import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const AD = "http://localhost:3171";
const browser = await chromium.launch();
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const say = (s) => console.log(`\n=== ${s}`);
const open = async (email, pw, viewport = { width: 1360, height: 900 }, extra = {}) => {
  const ctx = await browser.newContext({ viewport, ...extra });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|No routes matched|example\.com/.test(m.text())) problems.push(`${email}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${email} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders", { timeout: 30000 });
  return { ctx, page };
};

say("owner — chats");
let { ctx, page } = await open("o@acme.test", "Owner123!");
const nav = page.getByRole("link", { name: /WhatsApp/ }).first();
ok(await nav.waitFor({ timeout: 10000 }).then(() => true).catch(() => false), "WhatsApp is in the sidebar for the owner");
ok(/1/.test(await nav.innerText()), "…with a badge for the chat that has unread messages", await nav.innerText());
await nav.click();
await page.waitForURL(/\/whatsapp\/chats/);
await page.waitForSelector("text=Riya Sharma");
for (const t of ["Chats", "Numbers", "Broadcast", "Access"]) ok(await page.getByRole("link", { name: t, exact: true }).isVisible(), `owner sees the ${t} tab`);
ok(!(await page.getByText(/None of your WhatsApp numbers is connected/).isVisible().catch(() => false)), "no 'nothing connected' warning while a number is online");
await page.screenshot({ path: "wa-1-list.png" });
await page.getByRole("button", { name: /Riya Sharma/ }).click();
await page.waitForSelector("text=2 plates of kurkure momos");
await page.waitForTimeout(800);
await page.screenshot({ path: "wa-2-chat.png" });
ok(await page.getByText("Full menu.pdf").isVisible(), "a document shows with its name");
ok(await page.locator('img[alt="menu.svg"]').isVisible(), "a photo shows in the chat");
ok(await page.getByLabel("Read").first().isVisible(), "read messages show the read ticks");
await page.waitForTimeout(1500);
const badgeAfter = await page.getByRole("link", { name: /WhatsApp/ }).first().innerText();
ok(!/\d/.test(badgeAfter.replace("WhatsApp", "")), "opening the chat clears its unread badge", badgeAfter);

// send a message
await page.getByRole("textbox", { name: "Message" }).fill("Done! Ready in 20 minutes 🙂");
await page.keyboard.press("Enter");
await page.waitForFunction(() => document.querySelector('textarea[aria-label="Message"]')?.value === "", null, { timeout: 10000 }).then(() => ok(true, "the box empties after sending")).catch(() => ok(false, "the box empties after sending"));
await page.locator(".wa-msg", { hasText: "Ready in 20 minutes" }).waitFor({ timeout: 10000 });
ok((await page.locator(".wa-msg", { hasText: "Ready in 20 minutes" }).locator('svg[aria-label="Waiting to send"]').count()) === 1, "a sent message appears at once, waiting for the worker (clock tick)");

// attach a photo
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFElEQVR42mP8z8BQz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC", "base64");
writeFileSync("pic.png", png);
await page.locator('input[type="file"]').setInputFiles("pic.png");
ok(await page.getByText(/pic\.png/).isVisible(), "an attachment shows before sending, with its name");
await page.getByRole("textbox", { name: "Message" }).fill("Your bill");
await page.getByRole("button", { name: "Send" }).click();
await page.locator(".wa-msg", { hasText: "Your bill" }).waitFor({ timeout: 10000 });
ok((await page.locator('img[alt="pic.png"]').count()) === 1, "the photo goes into the chat with its caption");

// the offline number → choose another
await page.getByRole("button", { name: /Kabir/ }).click();
await page.waitForSelector("text=Is the Preet Vihar outlet open today?");
ok(await page.getByText("Order update").isVisible(), "an order update is labelled as one");
ok(await page.locator("header").getByText("no offers").isVisible(), "an opted-out customer is marked");
await page.getByRole("textbox", { name: "Message" }).fill("Yes, till 11 pm!");
await page.keyboard.press("Enter");
const dlg = page.getByRole("dialog", { name: "Number not connected" });
await dlg.waitFor({ timeout: 10000 });
ok(/Number 2 isn't connected right now/.test(await dlg.innerText()), "its number is offline → the owner is asked", (await dlg.innerText()).slice(0, 60));
ok(await dlg.getByText("Counter phone").isVisible(), "…offering the number that IS online");
await page.screenshot({ path: "wa-3-offline.png" });
await dlg.getByRole("button", { name: "Send from this number" }).click();
await page.waitForSelector("text=Yes, till 11 pm!", { timeout: 10000 });
await page.waitForTimeout(600);
ok(await page.getByRole("button", { name: /Sent from Counter phone/ }).isVisible(), "the message goes, and the chat now uses Counter phone");

// failed + scheduled
await page.getByRole("button", { name: /Meera/ }).click();
await page.waitForSelector("text=isn't on WhatsApp");
ok(await page.getByRole("button", { name: "Try again" }).isVisible(), "a failed message says why, with 'Try again'");
await page.getByRole("button", { name: /91 98444 44444/ }).click();
await page.locator(".wa-msg", { hasText: "Diwali special" }).waitFor({ timeout: 10000 });
ok(await page.getByText(/sends (tomorrow|at) \d/i).isVisible(), "a paced broadcast message says when it will go", (await page.locator(".wa-msg").last().innerText()).replace(/\n+/g, " | "));
ok(await page.getByText(/hasn.t written to you yet/).isVisible(), "the composer warns about the slow pace for a number that never wrote");

// new chat
await page.getByRole("button", { name: "Start a new chat" }).click();
await page.getByPlaceholder(/98765 43210/).fill("98111 22233");
await page.getByPlaceholder("e.g. Riya").fill("Aarav");
await page.getByRole("button", { name: "Open chat" }).click();
await page.waitForURL(/\/whatsapp\/chats\/[0-9a-f]{24}/);
await page.waitForSelector("text=No messages yet.");
ok(/Aarav/.test(await page.locator("header").filter({ hasText: "Aarav" }).first().innerText()), "a new chat opens, ready to write");

// clear + delete
await page.getByRole("button", { name: /Riya Sharma/ }).click();
await page.getByRole("button", { name: "Chat options" }).click();
await page.getByText("Clear chat", { exact: true }).click();
await page.getByRole("dialog").getByRole("button", { name: "Clear chat" }).click();
await page.waitForSelector("text=No messages yet.");
ok(await page.getByRole("button", { name: /Riya Sharma/ }).isVisible(), "clear empties the chat but keeps it in the list");
await page.getByRole("button", { name: "Chat options" }).click();
await page.getByText("Delete chat", { exact: true }).click();
await page.getByRole("dialog").getByRole("button", { name: "Delete chat" }).click();
await page.waitForTimeout(1200);
ok(!(await page.getByRole("button", { name: /Riya Sharma/ }).isVisible().catch(() => false)), "delete removes it from the list");

// search
await page.getByLabel("Search chats").fill("kab");
await page.waitForTimeout(900);
ok((await page.locator('aside button[aria-current], aside button').filter({ hasText: /Kabir|Meera|Aarav/ }).allInnerTexts()).every((t) => /Kabir/.test(t)), "search narrows the list");
await page.getByLabel("Search chats").fill("");

say("owner — numbers, broadcast, access");
await page.getByRole("link", { name: "Numbers", exact: true }).click();
await page.waitForSelector("text=Keeping your numbers safe");
await page.waitForTimeout(500);
ok(await page.getByText("Connected").first().isVisible() && await page.getByText("Offline", { exact: true }).isVisible() && await page.getByText("Waiting for the scan").isVisible(), "each number shows whether it's connected");
ok(await page.getByText(/today: 4\/15 new contacts/).isVisible(), "…and how much of today's allowance it has used");
await page.screenshot({ path: "wa-4-numbers.png", fullPage: true });
await page.getByRole("button", { name: "Show the QR" }).click();
const qrDlg = page.getByRole("dialog", { name: "Link a WhatsApp number" });
await qrDlg.waitFor();
await page.waitForTimeout(700);
ok(await qrDlg.locator('img[alt^="WhatsApp link code"]').isVisible(), "the link QR is drawn, with the steps on the phone");
await page.screenshot({ path: "wa-5-qr.png" });
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Link a number" }).click();
await page.getByLabel("Name for this number").fill("Kitchen phone");
await page.getByRole("button", { name: "Next: scan the code" }).click();
await page.getByRole("dialog", { name: "Link a WhatsApp number" }).waitFor();
ok(/Kitchen phone/.test(await page.getByRole("dialog", { name: "Link a WhatsApp number" }).innerText()), "naming a new number goes straight to its QR");
await page.keyboard.press("Escape");

await page.getByRole("link", { name: "Broadcast", exact: true }).click();
await page.waitForSelector("text=New broadcast");
await page.waitForTimeout(800);
const prevText = await page.locator("body").innerText();
ok(/5 customers will get it \(1 said STOP and are skipped\)/.test(prevText), "the broadcast says who gets it and who is skipped", prevText.match(/\d+ customers? will get it[^.]*\./)?.[0]);
ok(/about \d+ days? with \d+ numbers? online/.test(prevText), "…and roughly how long first contacts will take");
await page.getByLabel("Broadcast message").fill("Diwali: 20% off every plate this weekend!");
await page.getByRole("button", { name: "Review and send" }).click();
await page.getByRole("dialog", { name: "Send broadcast" }).getByRole("button", { name: "Send" }).click();
await page.waitForSelector("text=Queued. Progress shows below.", { timeout: 15000 });
await page.waitForTimeout(800);
ok(await page.getByText("Sending", { exact: true }).isVisible(), "the broadcast appears with its progress");
await page.screenshot({ path: "wa-6-broadcast.png", fullPage: true });

await page.getByRole("link", { name: "Access", exact: true }).click();
await page.waitForSelector("text=Who can use WhatsApp chat");
ok((await page.getByLabel("Manager access").inputValue()) === "send" && (await page.getByLabel("Cashier / Staff access").inputValue()) === "read", "access shows what each role may do");
await page.getByLabel("Kitchen access").selectOption("read");
await page.getByRole("button", { name: "Save access" }).click();
await page.waitForSelector("text=Saved.");
ok(true, "access saves");
await page.screenshot({ path: "wa-7-access.png" });

say("order updates setting");
await page.goto(AD + "/notifications", { waitUntil: "load" });
await page.getByRole("tab", { name: "Your WhatsApp numbers" }).or(page.getByRole("button", { name: "Your WhatsApp numbers" })).first().click();
await page.getByText("Send order updates from our WhatsApp numbers").click();
await page.getByText("Ready", { exact: true }).first().click();
await page.waitForSelector("text=What each update says");
ok(/Preview: Hi Aarav, your order #0042 at .* is Ready\./.test(await page.locator("body").innerText()), "order updates: pick statuses, see the wording");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: "wa-8-notify.png", fullPage: true });
await ctx.close();

say("manager (read and reply) and cashier (read only)");
({ ctx, page } = await open("m@acme.test", "Manager123!"));
await page.getByRole("link", { name: /WhatsApp/ }).first().click();
await page.waitForSelector("text=Kabir");
ok(!(await page.getByRole("link", { name: "Numbers", exact: true }).isVisible().catch(() => false)), "a manager doesn't get Numbers / Broadcast / Access");
ok(await page.getByRole("button", { name: "Start a new chat" }).isVisible(), "…but can start chats");
await ctx.close();
({ ctx, page } = await open("s@acme.test", "Staff1234!"));
await page.getByRole("link", { name: /WhatsApp/ }).first().click();
await page.waitForSelector("text=Kabir");
await page.getByRole("button", { name: /Kabir/ }).click();
await page.waitForSelector("text=Is the Preet Vihar outlet open today?");
ok(await page.getByText(/You can read this chat/).isVisible() && !(await page.getByRole("textbox", { name: "Message" }).isVisible().catch(() => false)), "a cashier can read but there's no reply box");
ok(!(await page.getByRole("button", { name: "Start a new chat" }).isVisible().catch(() => false)), "…and no 'new chat'");
await ctx.close();

say("phone");
({ ctx, page } = await open("o@acme.test", "Owner123!", { width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }));
await page.goto(AD + "/whatsapp/chats", { waitUntil: "load" });
await page.waitForSelector("text=Kabir");
await page.screenshot({ path: "wa-9-phone-list.png" });
await page.getByRole("button", { name: /Kabir/ }).click();
await page.waitForSelector("text=Is the Preet Vihar outlet open today?");
ok(await page.getByRole("button", { name: "Back to chats" }).isVisible(), "on a phone the chat fills the screen, with a way back");
ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, "no sideways scroll on a phone");
await page.waitForTimeout(1500);
const phoneLine = await page.locator('a[href^="tel:+"]').first().boundingBox();
ok(phoneLine && phoneLine.height < 24, "the customer's number stays on one line", phoneLine && `${Math.round(phoneLine.height)}px`);
await page.screenshot({ path: "wa-10-phone-chat.png" });
await ctx.close();

console.log(`\nTOTAL ${pass} passed, ${fail} failed`);
console.log("console problems:", problems.length ? problems : "none");
await browser.close();
