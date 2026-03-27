import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres:8011nedimK216@localhost:5432/microservices_db?schema=public' }
  }
});

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: hashedPassword, role: Role.ADMIN },
    create: { username: 'admin', password: hashedPassword, role: Role.ADMIN }
  });
  console.log('✅ Microservices Admin account securely created!', user);
}

main().catch(console.error).finally(()=>prisma.$disconnect());
