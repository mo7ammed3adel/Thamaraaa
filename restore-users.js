/**
 * Restores the sales and tele-sales staff that were deleted from the server
 * database, using rows exported from the previous Neon database.
 *
 * Idempotent: an existing user is updated back to their exported identity
 * (email, phone, status, manager) rather than duplicated. Manager links are
 * applied in a second pass so a manager that is itself being restored is
 * already present when its reports reference it.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const prisma = new PrismaClient();
const { users, hrRecords } = JSON.parse(fs.readFileSync(process.argv[2] || "restore-users.json", "utf8"));

const date = (v) => (v ? new Date(v) : null);

(async () => {
  let created = 0, updated = 0;

  // Pass 1 — the users themselves, without manager links.
  for (const u of users) {
    const data = {
      name: u.name, email: u.email, phone: u.phone, passwordHash: u.passwordHash,
      role: u.role, level: u.level, company: u.company, companyId: u.companyId,
      mustChangePassword: u.mustChangePassword, status: u.status,
      specialization: u.specialization, createdAt: date(u.createdAt),
      lastStatusChange: date(u.lastStatusChange), directManagerId: null,
    };
    const existing = await prisma.user.findUnique({ where: { id: u.id } });
    if (existing) {
      await prisma.user.update({ where: { id: u.id }, data });
      updated++;
    } else {
      await prisma.user.create({ data: { id: u.id, ...data } });
      created++;
    }
  }

  // Pass 2 — manager links, skipping any manager that no longer exists.
  let linked = 0;
  for (const u of users) {
    if (!u.directManagerId) continue;
    const manager = await prisma.user.findUnique({ where: { id: u.directManagerId }, select: { id: true } });
    if (!manager) { console.log(`  ! manager missing for ${u.name}, left unset`); continue; }
    await prisma.user.update({ where: { id: u.id }, data: { directManagerId: u.directManagerId } });
    linked++;
  }

  // HR records carry the employee code people can sign in with.
  let hr = 0;
  for (const r of hrRecords) {
    const { id, userId, ...rest } = r;
    const payload = Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, /At$|Date$/.test(k) && v ? new Date(v) : v])
    );
    await prisma.hrRecord.upsert({
      where: { userId },
      update: payload,
      create: { id, userId, ...payload },
    });
    hr++;
  }

  console.log(`created=${created} updated=${updated} managerLinks=${linked} hrRecords=${hr}`);
  await prisma.$disconnect();
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
