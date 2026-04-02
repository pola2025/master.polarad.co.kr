import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "", {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
  connectTimeout: 5000,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 200, 1000);
  },
});

redis.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});

export default redis;
