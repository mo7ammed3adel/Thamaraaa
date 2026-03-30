const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Seed Process ---');
  console.log('Database URL check:', process.env.DATABASE_URL ? 'URL is loaded' : 'URL IS MISSING!');
  
  const hash = await bcrypt.hash('admin123', 10);
  console.log('Password hash generated.');

  const adminEmail = 'admin@thamaraa.com';
  
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: hash, // Force update password just in case
      status: 'Active'
    },
    create: {
      name: 'Super Admin',
      email: adminEmail,
      passwordHash: hash,
      role: 'super_admin',
      status: 'Active',
    },
  });

  console.log('Admin account upserted:', admin.email);
  console.log('--- Seeding Finished Successfully ---');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('*** SEEDING ERROR ***');
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
