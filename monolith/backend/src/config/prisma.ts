import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:8011nedimK216@postgres:5432/monolith_db?schema=public";

// Connection pool deliberately capped at 3 with NO connection timeout.
// A single-process monolith shares ONE pool across all concurrent requests.
// Without a timeout, requests queue behind busy connections instead of failing
// fast — this lets latency climb visibly under load, which is exactly the
// pool exhaustion effect we demonstrate vs microservices' independent pools.
const pool = new Pool({
    connectionString,
    max: 3,                   // max concurrent DB connections
    idleTimeoutMillis: 30000, // close idle connections after 30s
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
