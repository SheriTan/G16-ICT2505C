import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "kabasadmin",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "kabas",
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;