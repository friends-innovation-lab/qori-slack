const Queue   = require('bull');
const { embedFileQueue } = require('./embededFile.queue');
const { readFolders } = require('../github');

const indexRepoQueue = new Queue('indexRepoQueue', {
  redis: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
  defaultJobOptions: { attempts: 2, removeOnComplete: true },
});

/** Worker: list files once, fan-out jobs to embedFileQueue */
indexRepoQueue.process(async (job) => {
  const { owner, repo, folder, channel_id } = job.data;

  const files = await readFolders(folder, repo);   // your helper

  for (const f of files) {
    await embedFileQueue.add(
      'embed-file',
      {
        content:    f.content,          // pass text so we don’t re-hit GitHub
        folderName: folder,
        path:       f.path,
        sha:        f.sha,
        channel_id,                     // keep for permissions filtering
      },
      { jobId: f.sha }                  // idempotent: same SHA → no dup job
    );
  }
});

module.exports = { indexRepoQueue };
