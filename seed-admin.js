const { prisma } = require('/app/dist/config/prisma.js');
const bcrypt = require('bcrypt');
async function seedAdmin() {
  const hash = await bcrypt.hash('admin', 10);
  await prisma.user.upsert({
    where: { username: 'admin@fyp.com' },
    update: { password: hash, role: 'ADMIN' },
    create: { username: 'admin@fyp.com', password: hash, role: 'ADMIN' }
  });
  console.log('Admin seeded!');
}
seedAdmin().catch(console.error).finally(() => prisma.$disconnect());
