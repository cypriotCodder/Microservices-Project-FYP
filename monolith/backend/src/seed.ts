import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { prisma } from './config/prisma';

dotenv.config();

async function seed() {
    try {
        const hash = await bcrypt.hash('Admin@123', 10);
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
    }
}

seed();
