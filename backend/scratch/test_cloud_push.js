const { pushSalesToCloud, getSyncStatus } = require('../services/cloudSync.service');

async function test() {
  console.log('1. Checking status before push...');
  const statusBefore = await getSyncStatus();
  console.log('Status before:', statusBefore);

  console.log('\n2. Pushing sales to Cloud ERP...');
  const pushRes = await pushSalesToCloud();
  console.log('Push result:', pushRes);

  console.log('\n3. Checking status after push...');
  const statusAfter = await getSyncStatus();
  console.log('Status after:', statusAfter);

  process.exit(0);
}

test().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
