/**
 * seedUsers.ts — Create 50 test accounts in the monolith Postgres DB.
 *
 * Run with:
 *   cd monolith/backend
 *   DATABASE_URL="postgresql://postgres:8011nedimK216@localhost:5433/monolith_db?schema=public" \
 *     npx ts-node prisma/seedUsers.ts
 *
 * All users get password "password123" (bcrypt cost 10).
 * k6 loadtest.js rotates through them with: user${VU % 50}@test.com
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const TOTAL_USERS = 50;
const PASSWORD    = 'password123';
const COST        = 10;

async function main() {
    console.log(`Seeding ${TOTAL_USERS} test users (bcrypt cost ${COST})...`);
    const hash = await bcrypt.hash(PASSWORD, COST); // hash once, share across all users

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < TOTAL_USERS; i++) {
        const username = `user${i}@test.com`;
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            skipped++;
            continue;
        }
        await prisma.user.create({ data: { username, password: hash } });
        created++;
        if (created % 10 === 0) process.stdout.write(`  created ${created}...\n`);
    }

    console.log(`Done — ${created} created, ${skipped} already existed.`);
    console.log(`Login with: username=user0@test.com … user49@test.com  password=password123`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
