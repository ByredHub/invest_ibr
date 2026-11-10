import { randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  availableForPayout,
  computeCounters,
  periodKey,
  periodRange,
  periodSeqOf,
  purchaseTotalKop,
  type OperationType,
} from "../lib/ledger";
import { formatRub } from "../lib/format";
import { normalizePhone } from "../lib/phone";
import { buildSnapshot } from "../lib/snapshot";

try {
  process.loadEnvFile(".env");
} catch {
  /* env provided by the environment */
}

const db = new PrismaClient();
const demo = process.argv.includes("--demo") || process.env.SEED_DEMO === "1";
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "storage/uploads");
const DEMO_PASSWORD = "Demo#2026";

async function ensureAdmin() {
  const phone = normalizePhone(process.env.ADMIN_PHONE ?? "");
  const password = process.env.ADMIN_PASSWORD;
  if (!phone || !password) throw new Error("Задайте ADMIN_PHONE и ADMIN_PASSWORD в окружении");
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await db.user.upsert({
    where: { phone },
    update: { passwordHash, role: "ADMIN" },
    create: { phone, passwordHash, role: "ADMIN", fullName: process.env.ADMIN_NAME || "Администратор" },
  });
  console.log(`Администратор: ${admin.phone}`);
  return admin;
}

const todayUTC = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};
const daysAgo = (n: number) => new Date(todayUTC().getTime() - n * 86_400_000);

const periodLabelText = (seq: number, start: Date, end: Date) => {
  const f = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join(".");
  return `Квартал ${seq} (${f(start)} — ${f(new Date(end.getTime() - 86_400_000))})`;
};

interface DemoInvestor {
  fullName: string;
  phone: string;
  status?: string;
  anchorDaysAgo: number; // дата первого взноса = якорь периодов
  deposit: number;
  transfer?: number;
  purchases?: { name: string; ticker: string; qty: string; price: number; photo: string }[];
  income?: number;
  incomePrev?: number[]; // доходы внутри уже завершившихся периодов
  pendingWithdrawal?: boolean;
}

const DEMO: DemoInvestor[] = [
  {
    fullName: "Иванов Иван Иванович", phone: "+79990000001", anchorDaysAgo: 10, deposit: 190_000, income: 2_500,
    purchases: [{ name: "Золотой слиток 100 г", ticker: "GOLD", qty: "1", price: 100_000, photo: "gold.png" }],
  },
  {
    fullName: "Петрова Мария Сергеевна", phone: "+79990000002", anchorDaysAgo: 130, deposit: 500_000, income: 18_400, incomePrev: [7_000, 5_000],
    purchases: [{ name: "Серебряная монета 999", ticker: "SLVR", qty: "10", price: 30_000, photo: "silver.png" }],
  },
  {
    fullName: "Сидоров Алексей Павлович", phone: "+79990000003", anchorDaysAgo: 40, deposit: 80_000,
    purchases: [{ name: "Облигация ИБР-01", ticker: "IBR01", qty: "95", price: 1_000, photo: "bond.png" }],
  },
  {
    fullName: "Козлова Елена Андреевна", phone: "+79990000004", anchorDaysAgo: 200, deposit: 1_250_000, income: 41_200, incomePrev: [18_000, 12_000],
    purchases: [
      { name: "Апартаменты ИБР, доля 0,45", ticker: "IBR-RE", qty: "0.45", price: 2_000_000, photo: "estate.png" },
      { name: "Золотой слиток 100 г", ticker: "GOLD", qty: "1.5", price: 100_000, photo: "gold.png" },
    ], pendingWithdrawal: true,
  },
  { fullName: "Новиков Дмитрий Олегович", phone: "+79990000005", status: "PAUSED", anchorDaysAgo: 100, deposit: 300_000, income: 6_000, incomePrev: [5_000] },
  { fullName: "Смирнов Артём Викторович", phone: "+79990000006", anchorDaysAgo: 70, deposit: 220_000, transfer: 150_000, income: 9_800, incomePrev: [8_000] },
];

async function seedDemo(adminId: string) {
  mkdirSync(uploadDir, { recursive: true });
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = new Date();
  const month = new Date();
  const incomeDate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));

  for (const inv of DEMO) {
    if (await db.user.findUnique({ where: { phone: inv.phone } })) continue;
    const anchor = daysAgo(inv.anchorDaysAgo);
    const user = await db.user.create({
      data: { role: "INVESTOR", fullName: inv.fullName, phone: inv.phone, passwordHash: hash, status: inv.status ?? "ACTIVE", periodAnchor: anchor },
    });
    const key = (d: Date) => periodKey(periodSeqOf(d, anchor));
    const log = (action: string, details: Record<string, unknown>) =>
      db.auditLog.create({ data: { actorId: adminId, clientId: user.id, action, details: JSON.stringify(details) } });
    const addOp = async (type: OperationType, rub: number, date: Date, assetId?: string, details: Record<string, unknown> = {}) => {
      const amountKop = Math.round(rub * 100);
      const op = await db.operation.create({
        data: { userId: user.id, type, amountKop, effectiveDate: date, quarterKey: key(date), assetId, createdById: adminId },
      });
      await log(type, { amountKop, date: date.toISOString().slice(0, 10), operationId: op.id, ...details });
    };

    await log("INVESTOR_CREATED", { fullName: user.fullName });
    await addOp("DEPOSIT", inv.deposit, anchor);
    if (inv.transfer) await addOp("TRANSFER", inv.transfer, new Date(anchor.getTime() + 8 * 86_400_000));
    let n = 12;
    for (const p of inv.purchases ?? []) {
      const stored = `${randomBytes(16).toString("hex")}.png`;
      copyFileSync(path.join(__dirname, "seed-assets", p.photo), path.join(uploadDir, stored));
      const file = await db.fileUpload.create({ data: { ownerId: user.id, storedAs: stored, mime: "image/png", size: 1 } });
      const unitPriceKop = p.price * 100;
      const totalKop = purchaseTotalKop(p.qty, unitPriceKop)!;
      const purchasedAt = new Date(anchor.getTime() + n * 86_400_000);
      const asset = await db.asset.create({
        data: {
          userId: user.id, name: p.name, ticker: p.ticker, quantity: p.qty, unitPriceKop, totalKop,
          fileId: file.id, purchasedAt,
        },
      });
      await addOp("PURCHASE", totalKop / 100, purchasedAt, asset.id, {
        title: p.name, ticker: p.ticker, quantity: p.qty, unitPriceKop, fileId: file.id,
      });
      n += 2;
    }
    const expiredSeqs: number[] = [];
    for (let seq = 1; periodRange(anchor, seq).end <= now; seq++) expiredSeqs.push(seq);
    // Доходы внутри уже завершившихся периодов — распределяются по периодам по порядку.
    const prevIncomes = inv.incomePrev ?? [];
    for (const [i, rub] of prevIncomes.entries()) {
      const seq = expiredSeqs[i];
      if (!seq) break;
      const { start } = periodRange(anchor, seq);
      await addOp("INCOME", rub, new Date(start.getTime() + 45 * 86_400_000));
    }
    if (inv.income) {
      const d = incomeDate >= anchor ? incomeDate : new Date(anchor.getTime() + 30 * 86_400_000);
      await addOp("INCOME", inv.income, expiredSeqs.includes(periodSeqOf(d, anchor)) ? new Date(periodRange(anchor, periodSeqOf(now, anchor)).start.getTime() + 86_400_000) : d);
    }
    const ops = await db.operation.findMany({ where: { userId: user.id } });
    const c = computeCounters(ops.map((o) => ({ type: o.type as OperationType, amountKop: o.amountKop })));
    console.log(`  ${inv.fullName}: общая ${c.totalKop / 100}, вложено ${c.investedKop / 100}, остаток ${c.balanceKop / 100}, доход ${c.incomeKop / 100}`);

    // Закрываем завершившиеся периоды и сразу открываем вывод (демо).
    for (let seq = 1; periodRange(anchor, seq).end <= now; seq++) {
      const { start, end } = periodRange(anchor, seq);
      const label = periodLabelText(seq, start, end);
      const quarter = await db.investorQuarter.create({
        data: { userId: user.id, seq, startAt: start, endAt: end, lockedById: adminId, payoutOpenedAt: now, payoutOpenedById: adminId },
      });
      const snapshot = await buildSnapshot(db as never, user, { label, end }, now);
      const opsAll = await db.operation.findMany({ where: { userId: user.id } });
      const report = await db.report.create({
        data: { userId: user.id, investorQuarterId: quarter.id, token: randomBytes(24).toString("base64url"), snapshot: JSON.stringify(snapshot) },
      });
      await db.notification.create({
        data: { userId: user.id, title: `Отчёт за ${label} доступен`, body: `Отчётный период закрыт. Ваш инвестиционный отчёт опубликован в личном кабинете.`, reportId: report.id },
      });
      const available = availableForPayout(
        opsAll.map((o) => ({ type: o.type as OperationType, amountKop: o.amountKop, quarterKey: o.quarterKey })),
        [key(end)],
        0,
      );
      if (available > 0) {
        await db.notification.create({ data: { userId: user.id, title: "Доступен вывод дохода", body: `Доступно к выводу: ${formatRub(available)}. Нажмите «Вывести» в личном кабинете.` } });
      }
      await db.auditLog.create({ data: { actorId: adminId, clientId: user.id, action: "QUARTER_LOCKED", details: JSON.stringify({ seq, startAt: start.toISOString(), endAt: end.toISOString() }) } });
      await db.auditLog.create({ data: { actorId: adminId, clientId: user.id, action: "PAYOUT_OPENED", details: JSON.stringify({ quarterId: quarter.id, seq }) } });
      console.log(`    ${label} закрыт, вывод открыт`);
    }
    if (inv.pendingWithdrawal) {
      const allOps = await db.operation.findMany({ where: { userId: user.id } });
      const opened = await db.investorQuarter.findMany({ where: { userId: user.id, payoutOpenedAt: { not: null } } });
      const available = availableForPayout(
        allOps.map((o) => ({ type: o.type as OperationType, amountKop: o.amountKop, quarterKey: o.quarterKey })),
        opened.map((q) => periodKey(q.seq)),
        0,
      );
      if (available > 0) {
        const r = await db.withdrawalRequest.create({ data: { userId: user.id, amountKop: available } });
        await db.auditLog.create({ data: { actorId: user.id, clientId: user.id, action: "WITHDRAWAL_REQUESTED", details: JSON.stringify({ amountKop: available, requestId: r.id }) } });
      }
    }
  }
  console.log(`Демо-инвесторы созданы. Пароль: ${DEMO_PASSWORD}`);
}

async function main() {
  const admin = await ensureAdmin();
  if (demo) await seedDemo(admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
