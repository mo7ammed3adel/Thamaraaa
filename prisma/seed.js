const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@thamaraa.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@thamaraa.com',
      passwordHash: hash,
      role: 'super_admin',
      status: 'Active',
    },
  });
  console.log('Admin seeded:', admin.email);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
