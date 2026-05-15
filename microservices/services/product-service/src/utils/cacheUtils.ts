import { redisClient } from '../config/redis';

/**
 * Deletes all Redis keys matching a glob pattern using non-blocking SCAN.
 * Safer than KEYS which blocks the Redis event loop for the full keyspace scan.
 *
 * node-redis v4+ returns the cursor as a string ('0' signals iteration complete).
 */
export async function delByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
        const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = reply.cursor;
        if (reply.keys.length > 0) {
            await redisClient.del(reply.keys);
        }
    } while (cursor !== '0');
}
