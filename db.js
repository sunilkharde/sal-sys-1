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


// async function checkConnectionState() {
//   try {
//     const connection = await pool.getConnection();
//     await connection.ping();
//     console.log('Connection state: connected');
//     connection.release();
//   } catch (error) {
//     console.error('Connection state: disconnected');
//   }
// }
// checkConnectionState();


// middleware function to get a connection from the pool and attach it to the request object
/*const getConnection = async (req, res, next) => {
  try {
    const conn = await pool.getConnection();
    req.dbConn = conn;
    console.log('Get connection is called..............')
    next();
  } catch (err) {
    next(err);
  }
};*/


export default pool;