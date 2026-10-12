const { 
  pushSalesToCloud, 
  pullMasterFromCloud, 
  getSyncStatus,
  syncMembersAndCreditCustomers,
  syncStaffAttendance,
  syncSettingsAndSequences,
  getRemotePool
} = require('../services/cloudSync.service');
const { getPool, sql } = require('../config/db');

async function testBidirectionalSync() {
  console.log('=== TEST 1: Cloud Sync Status Check ===');
  const initialStatus = await getSyncStatus();
  console.log('Cloud Status:', initialStatus);

  if (!initialStatus.isCloudReachable) {
    console.error('❌ Cloud ERP is not reachable at this time. Exiting.');
    process.exit(1);
  }

  console.log('\n=== TEST 2: Bidirectional Push to Cloud ERP ===');
  const pushResult = await pushSalesToCloud();
  console.log('Push Result:', pushResult);

  console.log('\n=== TEST 3: Bidirectional Pull from Cloud ERP ===');
  const pullResult = await pullMasterFromCloud();
  console.log('Pull Result:', pullResult);

  console.log('\n=== TEST 4: Direct Auxiliary Verification ===');
  const localPool = getPool();
  const remotePool = await getRemotePool();

  console.log('Testing syncMembersAndCreditCustomers...');
  await syncMembersAndCreditCustomers(remotePool, localPool);

  console.log('Testing syncStaffAttendance...');
  await syncStaffAttendance(remotePool, localPool);

  console.log('Testing syncSettingsAndSequences...');
  await syncSettingsAndSequences(remotePool, localPool);

  console.log('\n=== TEST 5: Final Sync Status ===');
  const finalStatus = await getSyncStatus();
  console.log('Final Cloud Status:', finalStatus);

  console.log('\n✅ All Bidirectional 2-Way Sync Engine tests completed successfully!');
  process.exit(0);
}

testBidirectionalSync().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
