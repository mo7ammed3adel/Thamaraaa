/**
 * Seeds a complete demo organisation: one user per role, with two to three
 * agents under every leader, plus enough supporting data to exercise the whole
 * pipeline (attendance, monthly targets and unworked leads).
 *
 * Safe to re-run: every record is keyed by a stable email or code and upserted,
 * so a second run updates rather than duplicates. It never deletes anything.
 *
 *   docker exec -w /app thamaraa-crm node scripts/seed-demo-org.js
 *
 * Every seeded account signs in with the password in DEMO_PASSWORD below.
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * The production runtime image is a Next.js standalone build, which carries
 * only the dependencies the server traced — bcryptjs is bundled into the app
 * chunks and is not resolvable as a module there. So the hash may be supplied
 * ready-made through DEMO_PASSWORD_HASH, and bcryptjs is used only when it is
 * actually installed (a normal dev checkout).
 */
async function resolvePasswordHash() {
  if (process.env.DEMO_PASSWORD_HASH) return process.env.DEMO_PASSWORD_HASH;
  try {
    const bcrypt = require("bcryptjs");
    return bcrypt.hash(DEMO_PASSWORD, 10);
  } catch {
    throw new Error(
      "bcryptjs is not available here — pass a ready-made hash in DEMO_PASSWORD_HASH"
    );
  }
}

const DEMO_PASSWORD = "Thamaraa@2026";
const COMPANY_NAME = "Thamara";
const LEADS_PER_TELE_AGENT = 8;

/**
 * The org chart, flat. `manager` names another entry's key, so the tree is
 * rebuilt in a second pass once every user exists.
 */
const PEOPLE = [
  // ── Sales line ──
  { key: "chief", name: "Chief Sales", role: "chief_sales", manager: null, level: "Senior" },

  { key: "smgr", name: "Sales Manager", role: "sales_manager", manager: "chief", level: "Senior" },
  { key: "sales1", name: "Sales Agent 1", role: "sales_agent", manager: "smgr", level: "Mid" },
  { key: "sales2", name: "Sales Agent 2", role: "sales_agent", manager: "smgr", level: "Junior" },
  { key: "sales3", name: "Sales Agent 3", role: "sales_agent", manager: "smgr", level: "Junior" },

  { key: "tmgr", name: "Tele Sales Manager", role: "tele_sales_manager", manager: "smgr", level: "Senior" },
  { key: "tele1", name: "Tele Sales Agent 1", role: "tele_sales_agent", manager: "tmgr", level: "Mid", specialization: "Hot" },
  { key: "tele2", name: "Tele Sales Agent 2", role: "tele_sales_agent", manager: "tmgr", level: "Junior", specialization: "Warm" },
  { key: "tele3", name: "Tele Sales Agent 3", role: "tele_sales_agent", manager: "tmgr", level: "Junior", specialization: "Cold" },

  // ── Account management ──
  { key: "ham", name: "Head Account Manager", role: "head_account_manager", manager: null, level: "Senior" },
  { key: "am1", name: "Account Manager 1", role: "account_manager", manager: "ham", level: "Mid" },
  { key: "am2", name: "Account Manager 2", role: "account_manager", manager: "ham", level: "Mid" },
  { key: "am3", name: "Account Manager 3", role: "account_manager", manager: "ham", level: "Junior" },

  // ── Technical delivery ──
  { key: "htech", name: "Head Technical", role: "head_technical", manager: null, level: "Senior" },

  { key: "tlsm", name: "Social Media Team Leader", role: "team_leader_social_media", manager: "htech", level: "Senior" },
  { key: "sm1", name: "Social Media Agent 1", role: "agent_social_media", manager: "tlsm", level: "Mid" },
  { key: "sm2", name: "Social Media Agent 2", role: "agent_social_media", manager: "tlsm", level: "Junior" },
  { key: "sm3", name: "Social Media Agent 3", role: "agent_social_media", manager: "tlsm", level: "Junior" },

  { key: "tlmb", name: "Media Buyer Team Leader", role: "team_leader_media_buyer", manager: "htech", level: "Senior" },
  { key: "mb1", name: "Media Buyer Agent 1", role: "agent_media_buyer", manager: "tlmb", level: "Mid" },
  { key: "mb2", name: "Media Buyer Agent 2", role: "agent_media_buyer", manager: "tlmb", level: "Junior" },
  { key: "mb3", name: "Media Buyer Agent 3", role: "agent_media_buyer", manager: "tlmb", level: "Junior" },

  // ── Creative ──
  { key: "lgd", name: "Graphic Design Leader", role: "leader_graphic_designer", manager: "htech", level: "Senior" },
  { key: "gd1", name: "Graphic Designer 1", role: "agent_graphic_designer", manager: "lgd", level: "Mid" },
  { key: "gd2", name: "Graphic Designer 2", role: "agent_graphic_designer", manager: "lgd", level: "Junior" },
  { key: "gd3", name: "Graphic Designer 3", role: "agent_graphic_designer", manager: "lgd", level: "Junior" },

  { key: "lmg", name: "Motion Graphic Leader", role: "leader_motion_graphic", manager: "htech", level: "Senior" },
  { key: "mg1", name: "Motion Graphic Agent 1", role: "agent_motion_graphic", manager: "lmg", level: "Mid" },
  { key: "mg2", name: "Motion Graphic Agent 2", role: "agent_motion_graphic", manager: "lmg", level: "Junior" },

  { key: "lui", name: "UI/UX Leader", role: "leader_ui", manager: "htech", level: "Senior" },
  { key: "ui1", name: "UI Agent 1", role: "agent_ui", manager: "lui", level: "Mid" },
  { key: "ui2", name: "UI Agent 2", role: "agent_ui", manager: "lui", level: "Junior" },

  // ── SEO ──
  { key: "hseo", name: "Head SEO", role: "head_seo", manager: null, level: "Senior" },
  { key: "tlseo", name: "SEO Team Leader", role: "team_leader_seo", manager: "hseo", level: "Senior" },
  { key: "seo1", name: "SEO Agent 1", role: "agent_seo", manager: "tlseo", level: "Mid" },
  { key: "seo2", name: "SEO Agent 2", role: "agent_seo", manager: "tlseo", level: "Junior" },
  { key: "cseo1", name: "Content SEO Agent 1", role: "agent_content_seo", manager: "tlseo", level: "Mid" },
  { key: "cseo2", name: "Content SEO Agent 2", role: "agent_content_seo", manager: "tlseo", level: "Junior" },

  // ── Support functions ──
  { key: "hr", name: "HR Manager", role: "hr_manager", manager: null, level: "Senior" },
  { key: "acc", name: "Accountant", role: "accountant", manager: null, level: "Mid" },
];

const SALARY_BY_LEVEL = { Junior: 6000, Mid: 10000, Senior: 16000 };
const NICHES = ["Fashion", "Electronics", "Beauty", "Food", "Fitness", "Home Decor"];
const CLASSIFICATIONS = ["Hot", "Warm", "Cold"];

const email = (key) => `${key}@thamaraa.com`;
const pad = (n, width = 3) => String(n).padStart(width, "0");

async function main() {
  const passwordHash = await resolvePasswordHash();

  const company =
    (await prisma.company.findUnique({ where: { name: COMPANY_NAME } })) ||
    (await prisma.company.create({ data: { name: COMPANY_NAME } }));

  // ── Pass 1: the people, without manager links ──
  const byKey = new Map();
  for (const person of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { email: email(person.key) },
      update: {
        name: person.name,
        role: person.role,
        level: person.level,
        status: "Active",
        companyId: company.id,
        specialization: person.specialization ?? null,
      },
      create: {
        name: person.name,
        email: email(person.key),
        passwordHash,
        role: person.role,
        level: person.level,
        status: "Active",
        companyId: company.id,
        company: COMPANY_NAME,
        specialization: person.specialization ?? null,
        // Seeded accounts are for testing, so skip the first-login password gate.
        mustChangePassword: false,
      },
    });
    byKey.set(person.key, user);
  }

  // ── Pass 2: manager links, now that every manager exists ──
  for (const person of PEOPLE) {
    if (!person.manager) continue;
    await prisma.user.update({
      where: { id: byKey.get(person.key).id },
      data: { directManagerId: byKey.get(person.manager).id },
    });
  }

  // ── HR records: give everyone an employee code they can also sign in with ──
  let index = 0;
  for (const person of PEOPLE) {
    index += 1;
    const user = byKey.get(person.key);
    const salary = SALARY_BY_LEVEL[person.level] ?? 8000;
    await prisma.hrRecord.upsert({
      where: { userId: user.id },
      update: { level: person.level, jobTitle: person.name },
      create: {
        userId: user.id,
        baseSalary: salary,
        startingSalary: salary,
        currentSalary: salary,
        level: person.level,
        monthlyTarget: 0,
        performanceHistory: "[]",
        employeeCode: `EMP-${pad(index)}`,
        jobTitle: person.name,
        department: person.role.replace(/_/g, " "),
        hiringDate: new Date(),
        employmentType: "full_time",
      },
    });
  }

  // ── Attendance: check in the people whose work depends on being present.
  // Meeting distribution skips any sales agent without an open check-in today,
  // so without this the very first distribution would fail. ──
  const presentKeys = ["sales1", "sales2", "sales3", "tele1", "tele2", "tele3"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkInAt = new Date();
  checkInAt.setHours(9, 0, 0, 0);

  for (const key of presentKeys) {
    const user = byKey.get(key);
    const existing = await prisma.attendance.findFirst({
      where: { userId: user.id, date: { gte: today } },
    });
    if (existing) {
      await prisma.attendance.update({
        where: { id: existing.id },
        data: { checkIn: checkInAt, checkOut: null },
      });
    } else {
      await prisma.attendance.create({
        data: { userId: user.id, date: today, checkIn: checkInAt, status: "on_time" },
      });
    }
  }

  // ── Monthly targets for the roles that are measured on one ──
  const month = new Date().toISOString().slice(0, 7);
  const TARGETS = { tele1: 40, tele2: 30, tele3: 30, tmgr: 100, sales1: 60000, sales2: 45000, sales3: 45000, smgr: 150000, chief: 300000 };
  for (const [key, target] of Object.entries(TARGETS)) {
    const user = byKey.get(key);
    await prisma.agentTarget.upsert({
      where: { agentId_month: { agentId: user.id, month } },
      update: { target },
      create: { agentId: user.id, month, target },
    });
  }

  // ── Leads: fresh, uncalled, spread across the tele agents ──
  // companyId is deliberately left unset so distribution resolves the company
  // from the assigned tele agent — the behaviour the app is designed around.
  const teleKeys = ["tele1", "tele2", "tele3"];
  let leadNumber = 0;
  let leadsCreated = 0;
  for (const key of teleKeys) {
    const agent = byKey.get(key);
    for (let i = 0; i < LEADS_PER_TELE_AGENT; i += 1) {
      leadNumber += 1;
      const phone = `05500${pad(leadNumber, 5)}`;
      const exists = await prisma.lead.findFirst({ where: { phone } });
      if (exists) continue;
      await prisma.lead.create({
        data: {
          name: `Test Client ${pad(leadNumber)}`,
          phone,
          classification: CLASSIFICATIONS[leadNumber % CLASSIFICATIONS.length],
          niche: NICHES[leadNumber % NICHES.length],
          source: "Demo Seed",
          status: "New",
          assignedTeleAgentId: agent.id,
          hasStore: leadNumber % 2 === 0,
        },
      });
      leadsCreated += 1;
    }
  }

  console.log(`users:        ${PEOPLE.length} (upserted)`);
  console.log(`hr records:   ${PEOPLE.length}`);
  console.log(`checked in:   ${presentKeys.length}`);
  console.log(`targets:      ${Object.keys(TARGETS).length} for ${month}`);
  console.log(`leads:        ${leadsCreated} created`);
  console.log(`password:     ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("SEED FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
