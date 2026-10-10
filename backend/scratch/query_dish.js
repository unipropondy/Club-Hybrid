const { poolPromise } = require("../config/db");

async function run() {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT DishGroupId, GroupName
      FROM DishGroupMaster
      WHERE DishGroupId IN ('79A30579-CB8A-48B1-859D-11BCEC4B7E45', '4B82EE14-DF26-4FF8-B333-0F2633A95BB9')
    `);
    console.log("Dish Groups:", result.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
