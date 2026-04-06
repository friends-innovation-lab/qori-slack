// // libs/redis.js

// const { createClient } = require("redis");

// /**
//  * Create Redis client instance
//  */
// const redisClient = createClient({
//   url: process.env.REDIS_URI,
// });

// redisClient.on("connect", () => {
//   console.log("Successfully connected to Redis!");
// });

// redisClient.on("error", (err) => {
//   console.log("Redis error:", err);
// });

// redisClient.connect().catch((err) => {
//   console.error("Failed to connect to Redis:", err);
// });

// module.exports = redisClient;
