const Queue = require('bull');
const { setupVectorStore } = require('../rag');

const embedFileQueue = new Queue('embedFileQueue', {
  redis: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: true,
  },
});

/** Worker: one job = one file **/
embedFileQueue.process(5, async (job) => {           // concurrency = 5
  const { content, folderName, path, sha } = job.data;
  await setupVectorStore(content, folderName, path, sha);
});

module.exports = { embedFileQueue };
