import redis from 'redis';
import { connectRedisClient } from "./redisConnection.server";

const client = redis.createClient({
    username: process.env.REDIS_USER || undefined,
    password: process.env.REDIS_PASS || undefined,
    database: Number(process.env.REDIS_DB) || 0,
    socket: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
    }
});

console.log("[Redis] Connecting to Redis...");
void connectRedisClient(client, (error) => console.error("[Redis] Connection error:", error))
    .then((connected) => {
        if (connected)
            console.log("[Redis] Connected");
    });

export default client;
