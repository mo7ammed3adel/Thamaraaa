const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const us = await p.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true, directManagerId: true },
    orderBy: { role: 'asc' },
  });
  console.log('users:', us.length);
  for (const u of us) console.log(`- ${u.role.padEnd(22)} ${u.status.padEnd(8)} ${u.email}  (mgr=${u.directManagerId || '-'})`);
  await p.$disconnect();
})();
