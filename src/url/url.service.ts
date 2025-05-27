import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ShortenURLDto } from './dtos/url.dto';
import { isURL } from 'class-validator';
import { db } from '../drizzle/db';
import { linkAccesses, links } from '../drizzle/schema';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { generateSlug } from '../utils/generateSlug';
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

    const shortUrl = `${baseUrl}/url/${urlCode}`;

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

    await this.sqlDB.insert(linkAccesses).values({
      linkId: url[0].id,
      accessedAt: new Date(),
    });

    return url[0].originalUrl;
  }

  async getUrlsWithBusiestPeriodByIp(ip: string) {
    const urls = await this.sqlDB
      .select({
        id: links.id,
        originalUrl: links.originalUrl,
        shortUrl: links.shortUrl,
        expiresAt: links.expiresAt,
        accessCount: links.accessCount,
      })
      .from(links)
      .where(eq(links.ip, ip));

    const urlIds = urls.map((u) => u.id);

    let periodBusiest = null;
    if (urlIds.length > 0) {
      const periodCase = sql<string>`
      CASE
        WHEN HOUR(CONVERT_TZ(accessed_at, '+00:00', '-03:00')) >= 6 AND HOUR(CONVERT_TZ(accessed_at, '+00:00', '-03:00')) < 12 THEN 'Manhã'
        WHEN HOUR(CONVERT_TZ(accessed_at, '+00:00', '-03:00')) >= 12 AND HOUR(CONVERT_TZ(accessed_at, '+00:00', '-03:00')) < 18 THEN 'Tarde'
        WHEN HOUR(CONVERT_TZ(accessed_at, '+00:00', '-03:00')) >= 18 AND HOUR(CONVERT_TZ(accessed_at, '+00:00', '-03:00')) < 24 THEN 'Noite'
        ELSE 'Madrugada'
      END
    `;
      const [busiest] = await this.sqlDB
        .select({
          period: periodCase,
          total: sql<number>`COUNT(*)`,
        })
        .from(linkAccesses)
        .where(inArray(linkAccesses.linkId, urlIds))
        .groupBy(periodCase)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(1);

      periodBusiest = busiest?.period ?? null;
    }

    return {
      urls,
      periodBusiest,
    };
  }

  async checkIfUrlIsRegistered(originalUrl: string) {
    const cacheKey = `registered-url:${originalUrl}`;
    const cached = await this.redis.get(cacheKey);

    if (cached === '1') {
      throw new BadRequestException('Essa URL já está cadastrada');
    }

    const result = await this.sqlDB
      .select()
      .from(links)
      .where(eq(links.originalUrl, originalUrl))
      .then((rows) => rows[0] ?? null);

    if (result) {
      await this.redis.set(cacheKey, '1', 'EX', 3600);
      throw new BadRequestException('Essa URL já está cadastrada');
    } else {
      await this.redis.set(cacheKey, '0', 'EX', 300);
    }
  }

  async verifyIfIpCreateFiveUrlsOrMore(ip: string) {
    const cacheKey = `ip-url-count:${ip}`;
    const cached = await this.redis.get(cacheKey);

    if (cached && Number(cached) >= 5) {
      throw new BadRequestException('Limite de 5 URLs por IP atingido');
    }

    const existingCountResult = await this.sqlDB
      .select({ count: sql<number>`COUNT(*)` })
      .from(links)
      .where(eq(links.ip, ip));

    const count = existingCountResult[0]?.count ?? 0;

    await this.redis.set(cacheKey, count.toString(), 'EX', 300);

    if (count >= 5) {
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
