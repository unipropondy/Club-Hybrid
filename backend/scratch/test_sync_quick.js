const { getSyncStatus, getRemotePool } = require('../services/cloudSync.service');

async function main() {
  console.log(new Date().toISOString(), 'Starting quick sync test...');
  try {
    const status = await getSyncStatus();
    console.log(new Date().toISOString(), 'Sync status result:', status);
  } catch (err) {
    console.error(new Date().toISOString(), 'Error:', err);
  }
  process.exit(0);
}

main();
