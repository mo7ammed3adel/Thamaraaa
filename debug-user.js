const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@thamaraa.com' }
  });
  console.log('User found:', user ? {
    id: user.id,
    email: user.email,
    status: user.status,
    role: user.role,
    passwordHash: user.passwordHash ? 'EXISTS' : 'MISSING'
  } : 'NOT FOUND');
}

main().then(() => prisma.$disconnect());
