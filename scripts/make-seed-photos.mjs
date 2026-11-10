import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../prisma/seed-assets/", import.meta.url));
mkdirSync(out, { recursive: true });

const frame = (bg, body) => `<html><body style="margin:0;width:800px;height:600px;background:${bg};overflow:hidden">
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">${body}</svg></body></html>`;

const items = {
  gold: frame(
    "#e9e4d6",
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4d77a"/><stop offset="1" stop-color="#b98a1d"/></linearGradient>
     <linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe9a3"/><stop offset="1" stop-color="#d9a92b"/></linearGradient></defs>
     <ellipse cx="400" cy="470" rx="260" ry="26" fill="#000" opacity=".12"/>
     <polygon points="170,430 630,430 580,300 220,300" fill="url(#g)"/>
     <polygon points="220,300 580,300 540,255 260,255" fill="url(#t)"/>
     <polygon points="170,430 630,430 630,452 170,452" fill="#8d6710"/>
     <text x="400" y="385" font-family="Georgia,serif" font-size="46" text-anchor="middle" fill="#7a5a10" letter-spacing="6">AU 999.9</text>
     <text x="400" y="340" font-family="Georgia,serif" font-size="22" text-anchor="middle" fill="#8d6710">100 g</text>`,
  ),
  silver: frame(
    "#dfe5e8",
    `<defs><radialGradient id="s" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#c3ccd2"/><stop offset="1" stop-color="#8a97a0"/></radialGradient></defs>
     <ellipse cx="400" cy="500" rx="190" ry="22" fill="#000" opacity=".14"/>
     <circle cx="400" cy="290" r="190" fill="#8a97a0"/><circle cx="400" cy="290" r="178" fill="url(#s)"/>
     <circle cx="400" cy="290" r="140" fill="none" stroke="#9aa6ae" stroke-width="3"/>
     <text x="400" y="285" font-family="Georgia,serif" font-size="64" text-anchor="middle" fill="#6b7882">Ag</text>
     <text x="400" y="340" font-family="Georgia,serif" font-size="24" text-anchor="middle" fill="#6b7882" letter-spacing="5">999 · 31,1 g</text>`,
  ),
  bond: frame(
    "#d7e6e5",
    `<rect x="120" y="110" width="560" height="380" rx="6" fill="#fbfaf6" stroke="#0b2a3f" stroke-width="3"/>
     <rect x="140" y="130" width="520" height="340" fill="none" stroke="#57cfcb" stroke-width="2"/>
     <text x="400" y="215" font-family="Georgia,serif" font-size="40" text-anchor="middle" fill="#041121" letter-spacing="8">ОБЛИГАЦИЯ</text>
     <line x1="220" y1="245" x2="580" y2="245" stroke="#041121" stroke-width="1.5"/>
     <text x="400" y="300" font-family="Georgia,serif" font-size="20" text-anchor="middle" fill="#41505c">ИНВЕСТИЦИОННЫЙ СЕРТИФИКАТ</text>
     <rect x="220" y="340" width="220" height="12" fill="#cfd8dc"/><rect x="220" y="368" width="300" height="12" fill="#cfd8dc"/><rect x="220" y="396" width="170" height="12" fill="#cfd8dc"/>
     <circle cx="560" cy="385" r="48" fill="#57cfcb"/><circle cx="560" cy="385" r="36" fill="none" stroke="#041121" stroke-width="2"/>`,
  ),
  estate: frame(
    "#ece7da",
    `<rect x="0" y="470" width="800" height="130" fill="#d6c7a1" opacity=".55"/>
     <rect x="170" y="190" width="200" height="290" fill="#0b2a3f"/><rect x="370" y="120" width="240" height="360" fill="#041121"/>
     ${[0, 1, 2, 3, 4].map((r) => [0, 1, 2].map((c) => `<rect x="${395 + c * 70}" y="${145 + r * 62}" width="42" height="36" fill="${(r + c) % 3 === 0 ? "#57cfcb" : "#1f4a63"}"/>`).join("")).join("")}
     ${[0, 1, 2, 3].map((r) => [0, 1].map((c) => `<rect x="${195 + c * 85}" y="${215 + r * 62}" width="42" height="36" fill="${(r * 2 + c) % 3 === 1 ? "#57cfcb" : "#1f4a63"}"/>`).join("")).join("")}
     <rect x="0" y="480" width="800" height="6" fill="#041121"/>`,
  ),
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
for (const [name, html] of Object.entries(items)) {
  await page.setContent(html);
  await page.screenshot({ path: `${out}${name}.png` });
}
await browser.close();
console.log("done", out);
