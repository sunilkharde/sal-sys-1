import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 0,
  queueLimit: 0
});

async function checkConnectionState() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    console.log('Connection state: connected');
    connection.release();
  } catch (error) {
    console.error('Connection state: disconnected');
  }
}
checkConnectionState();

// Reusing connection from the connection pool
export const executeQuery = async (sqlStr, params) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(sqlStr, params);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release(); // Release the connection back to the pool
  }
};

export default pool;