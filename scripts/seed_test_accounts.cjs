/**
 * seed_test_accounts.cjs
 *
 * Creates one idempotent test account per role so every dashboard can be
 * exercised with a real login. Re-runnable: every account is upserted by email.
 *
 * EXCLUDED ON PURPOSE (frozen modules — never touched):
 *   sales_agent, sales_manager, tele_sales_agent, tele_sales_manager
 *
 * Run:  node scripts/seed_test_accounts.cjs
 * Needs DATABASE_URL in the environment (loads .env if dotenv is available).
 */
try { require("dotenv").config(); } catch (_) { /* dotenv optional */ }

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const PASSWORD = "Thamara@2026";
const DOMAIN = "test.thamaraa.com";
const COMPANY = "Thamara";

// role → { name, level, manager, baseSalary, monthlyTarget }
// `manager` is another role key in this list, or "super_admin" (resolved from
// the existing admin created by prisma/seed.js).
const ACCOUNTS = [
  // Leadership / admin
  { role: "hr_manager",              name: "HR Manager (Test)",            level: "Senior", manager: "super_admin",          baseSalary: 8000, monthlyTarget: 0 },
  { role: "accountant",              name: "Accountant (Test)",            level: "Senior", manager: "super_admin",          baseSalary: 8000, monthlyTarget: 0 },
  { role: "chief_sales",             name: "Chief Sales (Test)",           level: "Senior", manager: "super_admin",          baseSalary: 12000, monthlyTarget: 0 },

  // Account management
  { role: "head_account_manager",    name: "Head Account Manager (Test)",  level: "Senior", manager: "super_admin",          baseSalary: 10000, monthlyTarget: 0 },
  { role: "account_manager",         name: "Account Manager (Test)",       level: "Mid",    manager: "head_account_manager", baseSalary: 6000, monthlyTarget: 0 },

  // Technical + SEO heads
  { role: "head_technical",          name: "Head Technical (Test)",        level: "Senior", manager: "head_account_manager", baseSalary: 9000, monthlyTarget: 0 },
  { role: "head_seo",                name: "Head SEO (Test)",              level: "Senior", manager: "head_account_manager", baseSalary: 9000, monthlyTarget: 0 },

  // SEO team
  { role: "team_leader_seo",         name: "TL SEO (Test)",                level: "Mid",    manager: "head_seo",             baseSalary: 6000, monthlyTarget: 15000 },
  { role: "agent_seo",               name: "Agent SEO (Test)",             level: "Junior", manager: "team_leader_seo",      baseSalary: 4000, monthlyTarget: 12000 },
  { role: "agent_content_seo",       name: "Agent Content SEO (Test)",     level: "Junior", manager: "team_leader_seo",      baseSalary: 4000, monthlyTarget: 12000 },

  // Media buyer team
  { role: "team_leader_media_buyer", name: "TL Media Buyer (Test)",        level: "Mid",    manager: "head_technical",       baseSalary: 6000, monthlyTarget: 15000 },
  { role: "agent_media_buyer",       name: "Agent Media Buyer (Test)",     level: "Junior", manager: "team_leader_media_buyer", baseSalary: 4000, monthlyTarget: 12000 },

  // Social media team
  { role: "team_leader_social_media", name: "TL Social Media (Test)",      level: "Mid",    manager: "head_technical",       baseSalary: 6000, monthlyTarget: 15000 },
  { role: "agent_social_media",       name: "Agent Social Media (Test)",   level: "Junior", manager: "team_leader_social_media", baseSalary: 4000, monthlyTarget: 12000 },

  // Graphic design team
  { role: "leader_graphic_designer", name: "Leader Graphic Design (Test)", level: "Mid",    manager: "head_technical",       baseSalary: 6000, monthlyTarget: 0 },
  { role: "agent_graphic_designer",  name: "Agent Graphic Design (Test)",  level: "Junior", manager: "leader_graphic_designer", baseSalary: 4000, monthlyTarget: 0 },

  // Motion graphic team
  { role: "leader_motion_graphic",   name: "Leader Motion Graphic (Test)", level: "Mid",    manager: "head_technical",       baseSalary: 6000, monthlyTarget: 0 },
  { role: "agent_motion_graphic",    name: "Agent Motion Graphic (Test)",  level: "Junior", manager: "leader_motion_graphic", baseSalary: 4000, monthlyTarget: 0 },

  // UI/UX team
  { role: "leader_ui",               name: "Leader UI/UX (Test)",          level: "Mid",    manager: "head_technical",       baseSalary: 6000, monthlyTarget: 0 },
  { role: "agent_ui",                name: "Agent UI/UX (Test)",           level: "Junior", manager: "leader_ui",            baseSalary: 4000, monthlyTarget: 0 },
];

const emailFor = (role) => `${role}@${DOMAIN}`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing. Set it before running this script.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(PASSWORD, 10);

  // ── Pass 1: upsert users + HrRecords ──
  for (const acc of ACCOUNTS) {
    const email = emailFor(acc.role);
    const user = await prisma.user.upsert({
      where: { email },
      update: { status: "Active", role: acc.role, level: acc.level, company: COMPANY },
      create: {
        name: acc.name,
        email,
        passwordHash: hash,
        role: acc.role,
        level: acc.level,
        company: COMPANY,
        status: "Active",
      },
    });

    await prisma.hrRecord.upsert({
      where: { userId: user.id },
      update: { baseSalary: acc.baseSalary, level: acc.level, monthlyTarget: acc.monthlyTarget },
      create: {
        userId: user.id,
        baseSalary: acc.baseSalary,
        level: acc.level,
        monthlyTarget: acc.monthlyTarget,
        performanceHistory: "[]",
      },
    });
    console.log(`  ✓ ${acc.role.padEnd(24)} ${email}`);
  }

  // ── Pass 2: wire direct-manager hierarchy ──
  const superAdmin = await prisma.user.findFirst({ where: { role: "super_admin" } });
  for (const acc of ACCOUNTS) {
    let managerId = null;
    if (acc.manager === "super_admin") {
      managerId = superAdmin ? superAdmin.id : null;
    } else {
      const mgr = await prisma.user.findUnique({ where: { email: emailFor(acc.manager) } });
      managerId = mgr ? mgr.id : null;
    }
    await prisma.user.update({ where: { email: emailFor(acc.role) }, data: { directManagerId: managerId } });
  }

  console.log("\n--- Test accounts ready ---");
  console.log(`Shared password: ${PASSWORD}`);
  console.log(`Login with email: <role>@${DOMAIN}  (e.g. agent_seo@${DOMAIN})`);
  console.log("Excluded (frozen): sales_agent, sales_manager, tele_sales_agent, tele_sales_manager");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("*** SEED TEST ACCOUNTS ERROR ***");
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
