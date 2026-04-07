import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: 'postgresql://postgres:8011nedimK216@localhost:5433/monolith_db?schema=public' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin', salt);
    
    await prisma.user.upsert({
        where: { username: 'admin@fyp.com' },
        update: { password: hashedPassword, role: 'ADMIN' },
        create: { username: 'admin@fyp.com', password: hashedPassword, role: 'ADMIN' },
    });
    console.log('Successfully created Admin user in Monolith DB');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
