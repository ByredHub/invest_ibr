import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE ?? "http://localhost:3101";
const ADMIN = { phone: process.env.ADMIN_PHONE ?? "+79990000000", password: process.env.ADMIN_PASSWORD ?? "Admin#2026ibr" };
const photoPath = fileURLToPath(new URL("../prisma/seed-assets/gold.png", import.meta.url));

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
  if (!cond) failures++;
};

class Client {
  cookie = "";
  async req(path, init = {}) {
    const res = await fetch(BASE + path, { redirect: "manual", ...init, headers: { ...(init.headers ?? {}), cookie: this.cookie } });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.endsWith("=")) this.cookie = "";
      else this.cookie = pair;
    }
    return res;
  }
  async json(path, body) {
    const res = await this.req(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  async text(path) {
    const res = await this.req(path);
    return { status: res.status, text: await res.text(), location: res.headers.get("location") };
  }
}

const phone = `+7999${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const admin = new Client();
const inv = new Client();

let r = await admin.json("/api/auth/login", { phone: ADMIN.phone, password: ADMIN.password });
check("admin login", r.status === 200 && r.data.redirect === "/admin");
r = await new Client().json("/api/auth/login", { phone: ADMIN.phone, password: "wrong-password" });
check("login with wrong password rejected", r.status === 401);

r = await admin.json("/api/admin/investors", { fullName: "Тестов Тест Тестович", phone, password: "Invest#1234", initialDeposit: "190 000" });
check("create investor with deposit 190 000", r.status === 200 && r.data.id, r.data.id);
const id = r.data.id;

const photo = new Blob([readFileSync(photoPath)], { type: "image/png" });
const purchaseForm = (pw, file = photo, qty = "1") => {
  const f = new FormData();
  f.set("name", "Золотой слиток 100 г");
  f.set("ticker", "gold");
  f.set("quantity", qty);
  f.set("unitPrice", "100 000");
  if (pw !== undefined) f.set("adminPassword", pw);
  if (file) f.set("photo", file, "gold.png");
  return f;
};
const post = async (path, form, client = admin) => {
  const res = await client.req(path, { method: "POST", body: form });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

r = await post(`/api/admin/investors/${id}/purchase`, purchaseForm("wrong-admin-pass"));
check("purchase with wrong admin password rejected (403)", r.status === 403, r.data.error);
r = await post(`/api/admin/investors/${id}/purchase`, purchaseForm(undefined));
check("purchase without admin password rejected", r.status === 400, r.data.error);
r = await post(`/api/admin/investors/${id}/purchase`, purchaseForm(ADMIN.password, null));
check("purchase without photo rejected", r.status === 400, r.data.error);
r = await post(`/api/admin/investors/${id}/purchase`, purchaseForm(ADMIN.password, new Blob(["not an image at all"], { type: "image/png" })));
check("purchase with fake image (bad magic bytes) rejected", r.status === 400, r.data.error);
r = await post(`/api/admin/investors/${id}/purchase`, purchaseForm(ADMIN.password));
check("purchase 100 000 with photo and correct password", r.status === 200 && r.data.totalKop === 10_000_000, JSON.stringify(r.data));

r = await admin.json(`/api/admin/investors/${id}/transfer`, { amount: "1000" });
check("transfer without password rejected", r.status === 400, r.data.error);
r = await admin.json(`/api/admin/investors/${id}/transfer`, { amount: "1000", adminPassword: "nope" });
check("transfer with wrong password rejected", r.status === 403, r.data.error);

const month = new Date().toISOString().slice(0, 7);
r = await admin.json(`/api/admin/investors/${id}/income`, { month, amount: "2 500" });
check("income 2 500", r.status === 200);

const page = await admin.text(`/admin/investors/${id}`);
const plain = page.text.replace(/<!-- -->|<[^>]+>/g, " ").replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ");
for (const [label, val] of [["Общая сумма", "192 500"], ["Вложено", "100 000"], ["Остаток", "92 500"], ["Доход", "2 500"]]) {
  check(`counter ${label} = ${val}`, new RegExp(`${label}\\s+${val}\\s*₽`, "i").test(plain));
}

r = await inv.json("/api/auth/login", { phone, password: "Invest#1234" });
check("investor login", r.status === 200 && r.data.redirect === "/cabinet");
let cab = await inv.text("/cabinet");
check("cabinet is live before any quarter close (counters + payout locked)", cab.status === 200 && /192[\s\u00a0\u202f]500/.test(cab.text) && cab.text.includes("после закрытия квартала") && !cab.text.includes("станет доступен"));
const firstToken = (html) => html.match('token\\\\":\\\\"([A-Za-z0-9_-]{32})')?.[1];
const plainOf = (html) => html.replace(/<!-- -->|<[^>]+>/g, " ").replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ");

const now0 = new Date();
// Якорь ~4 месяца назад — у инвестора уже завершился первый период.
const anchorDate = new Date(now0.getTime() - 120 * 86_400_000);
const anchorIso = anchorDate.toISOString().slice(0, 10);
const anchorMonth = (add) => {
  const d = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() + add, 1));
  return d.toISOString().slice(0, 7);
};

async function mkInvestor(name, deposit, date) {
  const ph = "+7997" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const res = await admin.json("/api/admin/investors", { fullName: name, phone: ph, password: "Invest#1234", initialDeposit: deposit, date });
  const c = new Client();
  await c.json("/api/auth/login", { phone: ph, password: "Invest#1234" });
  return { id: res.data.id, phone: ph, c };
}
const P = await mkInvestor("Выплатов Первый Тестович", "50 000", anchorIso);
const P2 = await mkInvestor("Выплатов Второй Тестович", "10 000", anchorIso);
const P3 = await mkInvestor("Выплатов Третий Тестович", "10 000", anchorIso);
r = await admin.json("/api/admin/investors/" + P.id + "/income", { month: anchorMonth(1), amount: "5 000" });
check("income in expired period (P, 5 000)", r.status === 200, JSON.stringify(r.data));
r = await admin.json("/api/admin/investors/" + P.id + "/income", { month: anchorMonth(2), amount: "2 500" });
check("income in expired period (P, 2 500)", r.status === 200);
await admin.json("/api/admin/investors/" + P2.id + "/income", { month: anchorMonth(1), amount: "3 000" });
await admin.json("/api/admin/investors/" + P3.id + "/income", { month: anchorMonth(1), amount: "2 000" });
r = await admin.json("/api/admin/investors/" + P3.id + "/status", { status: "PAUSED" });
let pc = await P.c.text("/cabinet");
check("investor sees new income live in cabinet + accrual notification", /7[\s\u00a0\u202f]500/.test(pc.text) && pc.text.includes("Начислен доход за"));
check("payout button disabled before payout is opened", pc.text.includes("после закрытия квартала"));

{
  r = await admin.json("/api/admin/quarters", { userId: P.id });
  check("close expired period for P", r.status === 200 && r.data.quarterId, JSON.stringify(r.data));
  const pQuarterId = r.data.quarterId;
  r = await admin.json("/api/admin/quarters", { userId: P2.id });
  const p2QuarterId = r.data.quarterId;
  r = await admin.json("/api/admin/quarters/payout", { quarterId: p2QuarterId });
  check("open payout for P2 period", r.status === 200, JSON.stringify(r.data));
  const prevTok = firstToken((await P.c.text("/cabinet")).text);
  check("period report listed in cabinet archive", !!prevTok);
  const prevRep = await P.c.text("/report/" + prevTok);
  check("period snapshot renders", prevRep.status === 200 && prevRep.text.includes("Структура портфеля"));

  r = await admin.json("/api/admin/quarters/payout", { quarterId: "nonexistent" });
  check("open payout for unknown period rejected (404)", r.status === 404, r.data.error);
  r = await admin.json("/api/admin/quarters/payout", { quarterId: pQuarterId });
  check("open payout for closed period", r.status === 200, JSON.stringify(r.data));
  r = await admin.json("/api/admin/quarters/payout", { quarterId: pQuarterId });
  check("repeat open payout rejected (409)", r.status === 409, r.data.error);
  r = await P.c.json("/api/admin/quarters/payout", { quarterId: pQuarterId });
  check("investor cannot open payout (403)", r.status === 403);

  pc = await P.c.text("/cabinet");
  check("payout opened notification delivered", pc.text.includes("Доступен вывод дохода"));
  r = await P.c.json("/api/cabinet/withdraw", { amountKop: 1 });
  check("investor requests payout; client amount ignored (= 7 500)", r.status === 200 && r.data.amountKop === 750000, JSON.stringify(r.data));
  const reqIdP = r.data.requestId;
  r = await P.c.json("/api/cabinet/withdraw");
  check("second pending request rejected (409)", r.status === 409, r.data.error);
  pc = await P.c.text("/cabinet");
  check("cabinet shows pending request", plainOf(pc.text).includes("на рассмотрении"));
  r = await admin.json("/api/admin/payouts/xxx/pay", { adminPassword: ADMIN.password });
  check("pay unknown request 404", r.status === 404);

  const reqId = reqIdP;
  r = await P.c.json("/api/admin/payouts/" + reqId + "/pay", { adminPassword: ADMIN.password });
  check("investor cannot pay requests (403)", r.status === 403);
  r = await P.c.json("/api/admin/payouts/" + reqId + "/reject", { reason: "test" });
  check("investor cannot reject requests (403)", r.status === 403);
  r = await admin.json("/api/admin/payouts/" + reqId + "/pay", { adminPassword: "wrong" });
  check("pay with wrong password rejected (403)", r.status === 403, r.data.error);
  r = await admin.json("/api/admin/payouts/" + reqId + "/pay", { adminPassword: ADMIN.password });
  check("pay with correct password", r.status === 200, JSON.stringify(r.data));
  r = await admin.json("/api/admin/payouts/" + reqId + "/pay", { adminPassword: ADMIN.password });
  check("pay twice rejected (409)", r.status === 409);
  const pp = plainOf((await admin.text("/admin/investors/" + P.id)).text);
  check("after payout: Общая 50 000, Доход 7 500, Выплачено 7 500", /Общая сумма\s+50 000\s*₽/.test(pp) && /Доход\s+7 500\s*₽/.test(pp) && /Выплачено: 7 500/.test(pp));
  pc = await P.c.text("/cabinet");
  check("after payout available = 0 and notification sent", pc.text.includes("Выплата проведена") && !plainOf(pc.text).includes("Забрать 7"));
  r = await P.c.json("/api/cabinet/withdraw");
  check("no second request when nothing available (400)", r.status === 400, r.data.error);

  r = await P2.c.json("/api/cabinet/withdraw");
  check("P2 requests payout (3 000)", r.status === 200 && r.data.amountKop === 300000);
  const id2 = r.data.requestId;
  r = await admin.json("/api/admin/payouts/" + id2 + "/reject", {});
  check("reject without reason rejected (400)", r.status === 400, r.data.error);
  r = await admin.json("/api/admin/payouts/" + id2 + "/reject", { reason: "Неверные реквизиты" });
  check("reject with reason", r.status === 200);
  const pc2 = await P2.c.text("/cabinet");
  check("investor sees rejection reason and notification", pc2.text.includes("Неверные реквизиты") && pc2.text.includes("Заявка на вывод отклонена"));
  r = await P2.c.json("/api/cabinet/withdraw");
  check("after rejection investor can request again", r.status === 200);

  r = await P3.c.json("/api/cabinet/withdraw");
  check("PAUSED investor cannot request (403)", r.status === 403, r.data.error);
}
for (const path of ["/api/admin/quarters", `/api/admin/investors/${id}/deposit`]) {
  r = await inv.json(path, { amount: "1", all: true });
  check(`investor gets 403 on ${path}`, r.status === 403);
}
r = await inv.json("/api/admin/investors", { fullName: "Хакер Хакер", phone: "+79998887766", password: "12345678" });
check("investor cannot create investors (403)", r.status === 403);
const adminPage = await inv.text("/admin");
check("investor redirected away from /admin", adminPage.status >= 300 && adminPage.status < 400, adminPage.location ?? "");
const anon = await new Client().text("/admin");
check("anonymous redirected to login from /admin", anon.status >= 300 && anon.status < 400 && (anon.location ?? "").includes("/login"));

const fileMatch = page.text.match(/\/api\/files\/([a-z0-9]+)/);
check("asset photo present in admin page", !!fileMatch);
const fileId = fileMatch?.[1];
const own = await inv.req(`/api/files/${fileId}`);
check("owner can fetch own photo", own.status === 200 && own.headers.get("content-type") === "image/png");
const other = new Client();
const phone2 = `+7998${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
await admin.json("/api/admin/investors", { fullName: "Другой Инвестор", phone: phone2, password: "Invest#1234" });
await other.json("/api/auth/login", { phone: phone2, password: "Invest#1234" });
const foreign = await other.req(`/api/files/${fileId}`);
check("other investor cannot fetch foreign photo (404)", foreign.status === 404);
const unauth = await new Client().req(`/api/files/${fileId}`);
check("anonymous cannot fetch photo (401)", unauth.status === 401);
check("admin can fetch photo", (await admin.req(`/api/files/${fileId}`)).status === 200);

// У основного инвестора якорь — сегодня, период P1 начался: его можно закрыть досрочно.
r = await admin.json("/api/admin/quarters", { userId: id });
check("close current period P1 for test investor", r.status === 200 && r.data.quarterId, JSON.stringify(r.data));
r = await admin.json("/api/admin/quarters", { userId: id });
check("repeat close — nothing to close (400)", r.status === 400, r.data.error);

cab = await inv.text("/cabinet");
const tok = firstToken(cab.text);
check("period report listed in cabinet archive", !!tok);
const snap = await inv.text("/report/" + tok);
check("snapshot report shows total 192 500 and portfolio", snap.status === 200 && snap.text.includes("Структура портфеля") && /192[\s\u00a0\u202f]500/.test(snap.text));
check("cabinet stays live after period close", /192[\s\u00a0\u202f]500/.test(cab.text) && !cab.text.includes("станет доступен"));
check("notification with report token present in cabinet", !!tok);
check("/report/[token] owner 200", (await inv.text("/report/" + tok)).status === 200);
check("/report/[token] admin 200", (await admin.text("/report/" + tok)).status === 200);
check("/report/[token] other investor 404", (await other.text("/report/" + tok)).status === 404);
const anonRep = await new Client().text("/report/" + tok);
check("/report/[token] anonymous redirected to login", anonRep.status >= 300 && anonRep.status < 400 && (anonRep.location ?? "").includes("/login"), anonRep.location ?? "");
r = await admin.json(`/api/admin/investors/${id}/deposit`, { amount: "5 000" });
check("deposit into locked period rejected", r.status === 409, `${r.status} ${r.data.error}`);
const curMonth = new Date().toISOString().slice(0, 7);
r = await admin.json(`/api/admin/investors/${id}/income`, { month: curMonth, amount: "100" });
check("income into locked period rejected", r.status >= 400, `${r.status} ${r.data.error}`);
r = await admin.json(`/api/admin/investors/${id}/deposit`, { amount: "5 000", date: "2020-01-15" });
check("deposit before anchor (seq 0) still allowed", r.status === 200);

const reportLink = (await admin.text("/admin/quarters")).text.match(/\/report\/([A-Za-z0-9_-]{32})/);
check("admin quarters page lists 32-char tokens", !!reportLink);
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
console.log(JSON.stringify({ investorPhone: phone, investorPassword: "Invest#1234", id }));
process.exit(failures ? 1 : 0);
