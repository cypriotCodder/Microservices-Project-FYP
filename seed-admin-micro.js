const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedAdmin() {
  const hash = await bcrypt.hash('admin', 10);
  await prisma.user.upsert({
    where: { username: 'admin@fyp.com' },
    update: { password: hash, role: 'ADMIN' },
    create: { username: 'admin@fyp.com', password: hash, role: 'ADMIN' }
  });
  console.log('Admin seeded on microservices!');
}
seedAdmin().catch(console.error).finally(() => { pool.end(); prisma.$disconnect(); });
