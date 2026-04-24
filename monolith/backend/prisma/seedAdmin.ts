import { prisma } from '../src/config/prisma';
import bcrypt from 'bcrypt';

async function main() {
    const hash = await bcrypt.hash('admin', 10);
    await prisma.user.upsert({
        where: { username: 'admin@fyp.com' },
        update: { password: hash, role: 'ADMIN' },
        create: { username: 'admin@fyp.com', password: hash, role: 'ADMIN' }
    });
    console.log('Admin seeded successfully for Monolith!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
