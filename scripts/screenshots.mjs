import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../screenshots/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const LIVE = process.env.LIVE ?? "http://localhost:3100"; // demo DB, quarter not closed
const DONE = process.env.DONE ?? "http://localhost:3101"; // DB with closed quarter
const ADMIN = { phone: "+79990000000", password: process.env.ADMIN_PASSWORD ?? "Admin#2026ibr" };
const IVANOV = { phone: "+79990000001", password: "Demo#2026" };

const browser = await chromium.launch();

async function session(base, creds, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "ru-RU" });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => errors.push(`${page.url()} pageerror ${e.message.slice(0, 200)}`));
  await page.goto(`${base}/login`);
  await page.fill('input[type="tel"]', creds.phone);
  await page.fill('input[autocomplete="current-password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|cabinet)/);
  return { ctx, page };
}
const errors = [];
const shot = async (page, name, full = true) => {
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => errors.push(`${name}: images not loaded`));
  if (full) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const vp = page.viewportSize();
    await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, h) });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}${name}.png` });
    await page.setViewportSize(vp);
  } else {
    await page.screenshot({ path: `${OUT}${name}.png` });
  }
};
const desktop = { width: 1440, height: 900 };

{
  const ctx = await browser.newContext({ viewport: desktop });
  const page = await ctx.newPage();
  await page.goto(`${LIVE}/login`);
  await page.waitForLoadState("networkidle");
  await shot(page, "01-login", false);
  await ctx.close();
}

{
  const { ctx, page } = await session(LIVE, ADMIN, desktop);
  await page.waitForLoadState("networkidle");
  await shot(page, "02-admin-dashboard");
  await page.goto(`${LIVE}/admin/investors`);
  await page.waitForLoadState("networkidle");
  await shot(page, "03-admin-investors");
  await page.click("text=Иванов Иван Иванович");
  await page.waitForURL(/investors\/.+/);
  await page.waitForLoadState("networkidle");
  await shot(page, "04-investor-card-history");
  await page.click('[role="tab"]:has-text("Активы")');
  await shot(page, "05-investor-card-assets");
  await page.click("text=Купить актив");
  await page.fill('input[name="name"]', "Серебряная монета 999");
  await page.fill('input[name="ticker"]', "SLVR");
  await page.fill('input[name="quantity"]', "20");
  await page.fill('input[name="unitPrice"]', "5 000");
  await page.setInputFiles('input[type="file"]', fileURLToPath(new URL("../prisma/seed-assets/silver.png", import.meta.url)));
  await page.waitForTimeout(300);
  await shot(page, "06-purchase-modal", false);
  await page.fill('input[name="unitPrice"]', "20 000");
  await page.waitForTimeout(200);
  await shot(page, "07-purchase-modal-negative-warning", false);
  await page.click('button:has-text("Продолжить")');
  await page.waitForTimeout(300);
  await shot(page, "08-confirm-password-modal", false);
  await page.goto(`${LIVE}/admin/history`);
  await page.waitForLoadState("networkidle");
  await shot(page, "09-admin-history");
  await ctx.close();
}

{
  const { ctx, page } = await session(LIVE, IVANOV, desktop);
  await page.waitForLoadState("networkidle");
  await shot(page, "10-cabinet-placeholder-desktop", false);
  await ctx.close();
  const m = await session(LIVE, IVANOV, { width: 390, height: 844 });
  await m.page.waitForLoadState("networkidle");
  await shot(m.page, "11-cabinet-placeholder-mobile");
  await m.ctx.close();
}

{
  const { ctx, page } = await session(DONE, IVANOV, desktop);
  await page.waitForLoadState("networkidle");
  await shot(page, "12-cabinet-report-desktop");
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: `${OUT}13-report-print.pdf`, format: "A4", printBackground: true });
  await ctx.close();
  const m = await session(DONE, IVANOV, { width: 390, height: 844 });
  await m.page.waitForLoadState("networkidle");
  await shot(m.page, "14-cabinet-report-mobile");
  await m.ctx.close();
  const a = await session(DONE, ADMIN, desktop);
  await a.page.goto(`${DONE}/admin`);
  await a.page.waitForLoadState("networkidle");
  await shot(a.page, "15-admin-dashboard-quarter-closed");
  await a.page.goto(`${DONE}/admin/quarters`);
  await a.page.waitForLoadState("networkidle");
  await shot(a.page, "16-admin-quarters-links");
  {
    const href = await a.page.getAttribute("a[href^=\"/report/\"]", "href");
    await a.page.goto(`${DONE}${href}`);
    await a.page.waitForLoadState("networkidle");
    await a.page.waitForTimeout(800);
  }
  const am = await session(DONE, ADMIN, { width: 390, height: 844 });
  await am.page.goto(`${DONE}/admin/investors`);
  await am.page.waitForLoadState("networkidle");
  await shot(am.page, "17-admin-investors-mobile");
  await am.ctx.close();
  await a.ctx.close();
}

await browser.close();
console.log("console errors:", errors.length ? errors : "none");
console.log("screenshots saved to", OUT);
