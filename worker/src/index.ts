import { Queue, Worker } from "bullmq";
import dotenv from "dotenv";
dotenv.config();

const connection = { connection: { url: process.env.REDIS_URL || "redis://localhost:6379" } };

export const holdQueue = new Queue("holds", connection);
export const settleGBQueue = new Queue("groupbuy-settle", connection);

new Worker("holds", async (job) => {
  console.log("Process hold job", job.id, job.data);
}, connection);

new Worker("groupbuy-settle", async (job) => {
  console.log("Settle group-buy", job.id, job.data);
}, connection);

console.log("Worker online");
