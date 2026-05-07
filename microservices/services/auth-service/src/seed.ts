import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

async function seed() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        const existing = await prisma.user.findUnique({
            where: { username: 'admin@fyp.com' }
        });

        if (!existing) {
            const hash = await bcrypt.hash('Admin@123', 10);
            await prisma.user.create({
                data: { username: 'admin@fyp.com', password: hash, role: 'ADMIN' }
            });
            console.log('[Seed] ✅ Created admin@fyp.com with role ADMIN');
        } else {
            console.log('[Seed] ℹ️  admin@fyp.com already exists — skipping');
        }
    } catch (e) {
        console.error('[Seed] ❌ Failed to seed admin user:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

seed();
