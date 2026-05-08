/**
 * seedUsers.ts — Create 50 test accounts in the monolith Postgres DB.
 * Run with: docker compose exec monolith-backend npx ts-node prisma/seedUsers.ts
 * All users get password "password123" (bcrypt cost 10).
 * k6 loadtest.js rotates: user${VU % 50}@test.com
 */
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const connectionString = process.env.DATABASE_URL ||
    "postgresql://postgres:8011nedimK216@postgres:5432/monolith_db?schema=public";

const pool    = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

const TOTAL_USERS = 50;
const PASSWORD    = "password123";
const COST        = 10;

async function main() {
    console.log(`Seeding ${TOTAL_USERS} test users (bcrypt cost ${COST})...`);
    const hash = await bcrypt.hash(PASSWORD, COST);
    let created = 0;
    for (let i = 0; i < TOTAL_USERS; i++) {
        const username = `user${i}@test.com`;
        await prisma.user.upsert({
            where:  { username },
            update: { password: hash },
            create: { username, password: hash },
        });
        created++;
        if (created % 10 === 0) process.stdout.write(`  upserted ${created}...\n`);
    }
    console.log(`Done -- ${created} users ready. Login: user0@test.com to user49@test.com / password123`);
}

main()
    .catch(console.error)
    .finally(async () => { await prisma.$disconnect(); await pool.end(); });