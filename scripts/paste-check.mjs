import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3100";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin#2026ibr";
const PHONE = `+7 999 ${Math.floor(100 + Math.random() * 899)}-${Math.floor(10 + Math.random() * 89)}-${Math.floor(10 + Math.random() * 89)}`;
let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
  if (!ok) failed++;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
page.on("response", (r) => r.status() >= 500 && errors.push(`${r.status()} ${r.request().method()} ${r.url()}`));

async function realPaste(selector, text) {
  await page.focus(selector);
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press("Control+V");
}
async function syntheticPaste(selector, text) {
  await page.focus(selector);
  await page.evaluate(
    ([sel, t]) => {
      const dt = new DataTransfer();
      dt.setData("text/plain", t);
      document.querySelector(sel).dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    [selector, text],
  );
}

await page.goto(`${BASE}/login`);
const phone = 'input[type="tel"]';
await page.click(phone);
check("focus on empty field shows +7 prefix", (await page.inputValue(phone)) === "+7 ", JSON.stringify(await page.inputValue(phone)));
await page.keyboard.type("89990000001");
check("typing 89990000001 -> mask", (await page.inputValue(phone)) === "+7 999 000-00-01", await page.inputValue(phone));
for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace");
check("backspace over separators works", (await page.inputValue(phone)) === "+7 999 000", await page.inputValue(phone));
for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace");
check("backspace over spaces works", (await page.inputValue(phone)) === "+7 99", await page.inputValue(phone));
await page.keyboard.type("9");
await page.fill(phone, "");
await page.evaluate(() => document.activeElement.blur());
check("blur with empty clears to placeholder", (await page.inputValue(phone)) === "");

for (const [label, text] of [
  ["8 (999) 000-00-01", "8 (999) 000-00-01"],
  ["+7(999)000-00-01", "+7(999)000-00-01"],
  ["tel:+79990000001", "tel:+79990000001"],
  ["9990000001", "9990000001"],
]) {
  await page.fill(phone, "");
  await realPaste(phone, text);
  check(`real Ctrl+V of "${label}"`, (await page.inputValue(phone)) === "+7 999 000-00-01", await page.inputValue(phone));
}
await page.fill(phone, "");
await syntheticPaste(phone, "8 (999) 000-00-01");
check("ClipboardEvent paste of 8 (999)...", (await page.inputValue(phone)) === "+7 999 000-00-01", await page.inputValue(phone));

await page.fill(phone, "");
await realPaste(phone, "8 (999) 000-00-00");
await realPaste('input[autocomplete="current-password"]', ADMIN_PASSWORD);
check("password field accepts paste", (await page.inputValue('input[autocomplete="current-password"]')) === ADMIN_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/\/admin/, { timeout: 15000 }).catch(() => {});
check("admin login with pasted phone + password", page.url().includes("/admin"), page.url());

await page.goto(`${BASE}/admin/investors`);
await page.click("text=Новый инвестор");
await page.fill('input[name="fullName"]', "Тест Вставка");
await realPaste('input[name="phone"]', `8 (${PHONE.slice(3, 6)}) ${PHONE.slice(7, 10)}-${PHONE.slice(11, 13)}-${PHONE.slice(14, 16)}`);
check("new-investor phone paste", (await page.inputValue('input[name="phone"]')) === PHONE, `${await page.inputValue('input[name="phone"]')} vs ${PHONE}`);
await page.fill('input[name="password"]', "Paste#12345");
await realPaste('input[name="initialDeposit"]', "190 000 ₽");
check("money paste strips ₽/spaces", (await page.inputValue('input[name="initialDeposit"]')) === "190000", await page.inputValue('input[name="initialDeposit"]'));
await page.click('form button[type="submit"]');
await page.waitForURL(/investors\/.+/, { timeout: 15000 }).catch(() => {});
await page.waitForLoadState("networkidle");
const text = (await page.innerText("body")).replace(/[\u00a0\u202f]/g, " ");
check("investor created with 190 000 deposit", page.url().includes("/investors/") && /190 000\s*₽/.test(text), page.url());

await page.goto(`${BASE}/admin/investors`);
await page.fill('input[placeholder^="Поиск"]', `8 ${PHONE.slice(3, 10)}`);
await page.waitForTimeout(300);
check("search with leading 8 finds investor", (await page.innerText("body")).includes("Тест Вставка"));

check("no console errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failed ? `${failed} FAILED` : "ALL PASSED", "phone:", PHONE);
process.exit(failed ? 1 : 0);
