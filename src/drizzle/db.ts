import { drizzle } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'db',
  user: 'user',
  password: 'pass',
  database: 'db',
  port: 3306,
});

export const db = drizzle(pool);
