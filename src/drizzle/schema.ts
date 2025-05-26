import {
  int,
  mysqlTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

export const links = mysqlTable('links', {
  id: serial('id').primaryKey(),
  urlCode: varchar('urlCode', { length: 20 }).notNull().unique(),
  originalUrl: varchar('original_url', { length: 2048 }).notNull(),
  shortUrl: varchar('short_url', { length: 2048 }).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  accessCount: int('access_count').default(0),
  ip: varchar('ip', { length: 45 }).notNull(),
});
