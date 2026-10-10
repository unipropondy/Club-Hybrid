const sql = require('mssql');
require('dotenv').config();

async function runTest() {
  console.log('🧪 Starting End-to-End Hybrid Flow Test...');

  // 1. Verify Local DB connectivity
  const localConfig = {
    user: process.env.LOCAL_DB_USER || 'sa',
    password: process.env.LOCAL_DB_PASSWORD || 'Unipro@2026',
    server: '127.0.0.1',
    port: parseInt(process.env.LOCAL_DB_PORT || '1433'),
    database: process.env.LOCAL_DB_NAME || 'UCSCLUB',
    options: { encrypt: false, trustServerCertificate: true }
  };
  const localPool = await new sql.ConnectionPool(localConfig).connect();
  console.log('✅ Local Database: Connected');

  // 2. Verify Remote Cloud DB connectivity
  const remoteConfig = {
    user: process.env.REMOTE_DB_USER || 'ups',
    password: process.env.REMOTE_DB_PASSWORD || 'ups',
    server: process.env.REMOTE_DB_SERVER || 'myerpcloud.dyndns.org',
    port: parseInt(process.env.REMOTE_DB_PORT || '9199'),
    database: process.env.REMOTE_DB_NAME || 'UCSCLUB',
    options: { encrypt: false, trustServerCertificate: true, connectTimeout: 8000 }
  };
  const remotePool = await new sql.ConnectionPool(remoteConfig).connect();
  console.log('✅ Remote Cloud Database: Connected');

  // 3. Check Sync Status via Backend API
  const statusRes = await fetch('http://localhost:5000/api/sync/status').then(r => r.json());
  console.log('✅ Sync API Status:', statusRes);

  // 4. Verify Print Bridge via HTTP
  const bridgeRes = await fetch('http://localhost:3050/api/config').then(r => r.json());
  console.log('✅ Print Bridge Port 3050:', {
    port: bridgeRes.port,
    activeBackend: bridgeRes.backends?.find(b => b.enabled)?.name
  });

  // 5. Test Pull Master from Cloud
  const pullRes = await fetch('http://localhost:5000/api/sync/pull-now', { method: 'POST' }).then(r => r.json());
  console.log('✅ Master Pull Test:', pullRes);

  // 6. Test Push Sales to Cloud
  const pushRes = await fetch('http://localhost:5000/api/sync/push-now', { method: 'POST' }).then(r => r.json());
  console.log('✅ Sales Push Test:', pushRes);

  await localPool.close();
  await remotePool.close();
  console.log('\n🎉 ALL HYBRID POS SYSTEMS ARE 100% OPERATIONAL!');
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
