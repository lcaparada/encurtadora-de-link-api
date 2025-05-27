import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ShortenURLDto } from './dtos/url.dto';
import { isURL } from 'class-validator';
import { db } from '../drizzle/db';
import { links } from '../drizzle/schema';
import { and, eq, gt, sql } from 'drizzle-orm';
import { generateSlug } from '../utils/generateSlug';
import { redis } from '../redis/redis';
import Redis from 'ioredis';

const URL_EXPIRES_AT = Number(process.env.URL_EXPIRES_AT ?? 86400);

@Injectable()
export class UrlService {
  constructor(
    @Inject('db') private readonly sqlDB: typeof db,
    @Inject('redis') private readonly redis: Redis,
  ) {}
  async shortenUrl({ originalUrl, ip }: ShortenURLDto & { ip: string }) {
    if (!isURL(originalUrl)) {
      throw new BadRequestException('Esse texto deve ser uma url válida.');
    }
    await this.checkIfUrlIsRegistered(originalUrl);
    await this.verifyIfIpCreateFiveUrlsOrMore(ip);

    const urlCode = await this.generateUniqueSlug();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + URL_EXPIRES_AT * 1000);

    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3001';

    const shortUrl = `${baseUrl}/${urlCode}`;

    await this.sqlDB.insert(links).values({
      urlCode,
      shortUrl,
      originalUrl,
      ip,
      expiresAt,
    });

    return { shortUrl };
  }

  async redirect(urlCode: string) {
    const cached = await this.redis.get(`shortlink:${urlCode}`);

    if (cached) {
      await this.sqlDB
        .update(links)
        .set({ accessCount: sql.raw('access_count + 1') })
        .where(eq(links.urlCode, urlCode));
      return cached;
    }

    const now = new Date();

    const url = await this.sqlDB
      .select()
      .from(links)
      .where(and(eq(links.urlCode, urlCode), gt(links.expiresAt, now)));

    if (!url[0]) {
      throw new NotFoundException('Link não encontrado ou expirado');
    }

    await this.sqlDB
      .update(links)
      .set({ accessCount: sql.raw('access_count + 1') })
      .where(eq(links.urlCode, urlCode));

    await redis.set(`shortlink:${urlCode}`, url[0].originalUrl, 'EX', 3600);

    return url[0].originalUrl;
  }

  async checkIfUrlIsRegistered(originalUrl: string) {
    const result = await this.sqlDB
      .select()
      .from(links)
      .where(eq(links.originalUrl, originalUrl))
      .then((rows) => rows[0] ?? null);

    if (result) {
      throw new BadRequestException('Essa URL já está cadastrada');
    }
  }

  async verifyIfIpCreateFiveUrlsOrMore(ip: string) {
    const existingCount = await this.sqlDB
      .select({ count: sql<number>`COUNT(*)` })
      .from(links)
      .where(eq(links.ip, ip));

    if (existingCount[0].count >= 5) {
      throw new BadRequestException('Limite de 5 URLs por IP atingido');
    }
  }

  async generateUniqueSlug(): Promise<string> {
    let slug = generateSlug();
    let exists = await this.sqlDB
      .select()
      .from(links)
      .where(eq(links.urlCode, slug))
      .limit(1);

    while (exists.length > 0) {
      slug = generateSlug();
      exists = await this.sqlDB
        .select()
        .from(links)
        .where(eq(links.urlCode, slug))
        .limit(1);
    }

    return slug;
  }
}
