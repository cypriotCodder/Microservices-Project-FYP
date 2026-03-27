import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres:8011nedimK216@localhost:5432/microservices_db?schema=public' } }
});

async function main() {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin', salt);
    
    await prisma.user.upsert({
        where: { username: 'admin@fyp.com' },
        update: { password: hashedPassword, role: 'ADMIN' },
        create: { username: 'admin@fyp.com', password: hashedPassword, role: 'ADMIN' },
    });
    console.log('Successfully created Admin user in Microservices DB');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
