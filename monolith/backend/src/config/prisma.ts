import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:8011nedimK216@postgres:5432/monolith_db?schema=public";

// Connection pool deliberately capped at 5.
// A single-process monolith shares ONE pool across all concurrent requests.
// Under high load (e.g. 500 VUs) this causes pool exhaustion, making latency
// degrade visibly — this is a key architectural limitation we demonstrate vs
// the microservices design where each service has its own independent pool.
const pool = new Pool({
    connectionString,
    max: 5,                   // max concurrent DB connections
    idleTimeoutMillis: 30000, // close idle connections after 30s
    connectionTimeoutMillis: 5000, // fail fast if no connection available
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
