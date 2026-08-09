const { Pool, types } = require('pg');
const env = require('./env');

// pg returns BIGINT (OID 20) and NUMERIC/DECIMAL (OID 1700) as strings by
// default, to avoid silently losing precision beyond what a JS number can
// hold. Our IDs/amounts never approach that range, and mysql2 (the driver
// this app was originally written against) returned both as plain numbers —
// so parse them the same way here rather than touch every call site.
types.setTypeParser(20, (val) => parseInt(val, 10));
types.setTypeParser(1700, (val) => parseFloat(val));

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  max: 10,
});

// Every query across the codebase was written for mysql2 — '?' placeholders
// and `const [rows] = await db.query(...)` destructuring. Rather than touch
// every call site's syntax, translate '?' -> '$1,$2,...' here and wrap the
// result as [rows] so the rest of the app is unaware the driver changed.
function toPgQuery(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// rows is an array, but arrays are objects — attaching affectedRows onto it
// lets `const [result] = await db.query('UPDATE/DELETE ...'); result.affectedRows`
// (the mysql2 idiom used throughout this codebase) keep working unchanged,
// since pg reports that count as rowCount rather than via the rows themselves.
function withAffectedRows(result) {
  const rows = result.rows;
  rows.affectedRows = result.rowCount;
  return rows;
}

async function query(sql, params = []) {
  const result = await pool.query(toPgQuery(sql), params);
  return [withAffectedRows(result), result.fields];
}

// Mirrors mysql2's PoolConnection shape (query/beginTransaction/commit/
// rollback/release) so transactional code elsewhere needs no changes beyond
// the SQL itself.
async function getConnection() {
  const client = await pool.connect();
  return {
    query: async (sql, params = []) => {
      const result = await client.query(toPgQuery(sql), params);
      return [withAffectedRows(result), result.fields];
    },
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release(),
  };
}

module.exports = {
  query,
  getConnection,
  end: () => pool.end(),
};
