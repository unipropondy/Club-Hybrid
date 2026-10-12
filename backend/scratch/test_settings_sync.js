const { syncSettingsAndSequences, getRemotePool } = require('../services/cloudSync.service');
const { getPool } = require('../config/db');

async function run() {
  const localPool = getPool();
  const remotePool = await getRemotePool();
  console.log('Running syncSettingsAndSequences directly...');
  await syncSettingsAndSequences(remotePool, localPool);
  console.log('Finished syncSettingsAndSequences successfully!');
  process.exit(0);
}

run().catch(e => {
  console.error('Error in run:', e);
  process.exit(1);
});
