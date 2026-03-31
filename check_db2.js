const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, passwordHash: true }
  });
  let plaintextCount = 0;
  let hashedCount = 0;
  
  for (const u of users) {
    if (u.passwordHash.startsWith('$2a$') || u.passwordHash.startsWith('$2b$')) {
      hashedCount++;
    } else {
      plaintextCount++;
      console.log(`Plaintext user: ${u.email} -> ${u.passwordHash}`);
      // Auto migrate if we want, but let's just log for now
    }
  }
  console.log(`Hashed: ${hashedCount}, Plaintext: ${plaintextCount}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
