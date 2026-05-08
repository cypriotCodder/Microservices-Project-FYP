import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

async function seed() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Create both tables via raw SQL so neither service's startup drops the other's table.
    // This is required because auth-service and recommendation-service share the same
    // public schema, and prisma db push would drop tables not in its own schema.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS "User" (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'USER',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS "Recommendation" (
            id SERIAL PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "productId" TEXT NOT NULL,
            score DOUBLE PRECISION NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log('[Seed] ✅ Shared schema tables verified (User + Recommendation)');

    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        const hash = await bcrypt.hash('admin', 10);
        await prisma.user.upsert({
            where: { username: 'admin@fyp.com' },
            update: { password: hash, role: 'ADMIN' },
            create: { username: 'admin@fyp.com', password: hash, role: 'ADMIN' },
        });
        console.log('[Seed] ✅ admin@fyp.com ready (created or updated)');
    } catch (e) {
        console.error('[Seed] ❌ Failed to seed admin user:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

seed();
