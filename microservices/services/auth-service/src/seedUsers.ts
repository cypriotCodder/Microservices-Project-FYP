/**
 * seedUsers.ts — Create 50 k6 test accounts in the auth-service Postgres DB.
 *
 * Run with:
 *   docker compose -f microservices/docker-compose.yml exec auth-service \
 *     node dist/seedUsers.js
 *
 * Or compile first:
 *   npx tsc src/seedUsers.ts --outDir dist --esModuleInterop
 *
 * All users get password "password123" (bcrypt cost 10).
 * k6 loadtest.js rotates: user${VU % 50}@test.com
 */
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

const TOTAL_USERS = 50;
const PASSWORD    = 'password123';
const COST        = 10;

async function main() {
    console.log(`[seedUsers] Seeding ${TOTAL_USERS} test users (bcrypt cost ${COST})...`);
    const hash = await bcrypt.hash(PASSWORD, COST);

    let created = 0;
    for (let i = 0; i < TOTAL_USERS; i++) {
        const username = `user${i}@test.com`;
        await prisma.user.upsert({
            where:  { username },
            update: { password: hash },
            create: { username, password: hash, role: 'USER' },
        });
        created++;
        if (created % 10 === 0) process.stdout.write(`  upserted ${created}...\n`);
    }

    console.log(`[seedUsers] Done — ${created} users ready.`);
    console.log(`[seedUsers] Login: user0@test.com … user49@test.com / password123`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); await pool.end(); });
