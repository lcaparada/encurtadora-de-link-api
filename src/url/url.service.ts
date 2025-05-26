import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ShortenURLDto } from './dtos/url.dto';
import { isURL } from 'class-validator';
import { db } from 'src/drizzle/db';
import { links } from 'src/drizzle/schema';
import { and, eq, gt, sql } from 'drizzle-orm';
import { generateSlug } from 'src/utils/generateSlug';
import { redis } from 'src/redis';

const URL_EXPIRES_AT = Number(process.env.URL_EXPIRES_AT ?? 86400);

@Injectable()
export class UrlService {
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

    await db.insert(links).values({
      urlCode,
      shortUrl,
      originalUrl,
      ip,
      expiresAt,
    });

    return shortUrl;
  }

  async redirect(urlCode: string) {
    const cached = await redis.get(`shortlink:${urlCode}`);

    if (cached) {
      await db
        .update(links)
        .set({ accessCount: sql.raw('access_count + 1') })
        .where(eq(links.urlCode, urlCode));
      return cached;
    }

    const now = new Date();

    const url = await db
      .select()
      .from(links)
      .where(and(eq(links.urlCode, urlCode), gt(links.expiresAt, now)));

    if (!url[0]) {
      throw new NotFoundException('Link não encontrado ou expirado');
    }

    await db
      .update(links)
      .set({ accessCount: sql.raw('access_count + 1') })
      .where(eq(links.urlCode, urlCode));

    await redis.set(`shortlink:${urlCode}`, url[0].originalUrl, 'EX', 3600);

    return url[0].originalUrl;
  }

  private async checkIfUrlIsRegistered(originalUrl: string) {
    const result = await db
      .select()
      .from(links)
      .where(eq(links.originalUrl, originalUrl))
      .then((rows) => rows[0] ?? null);

    if (result) {
      throw new BadRequestException('Essa URL já está cadastrada');
    }
  }

  private async verifyIfIpCreateFiveUrlsOrMore(ip: string) {
    const existingCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(links)
      .where(eq(links.ip, ip));

    if (existingCount[0].count >= 5) {
      throw new BadRequestException('Limite de 5 URLs por IP atingido');
    }
  }

  private async generateUniqueSlug(): Promise<string> {
    let slug = generateSlug();
    let exists = await db
      .select()
      .from(links)
      .where(eq(links.urlCode, slug))
      .limit(1);

    while (exists.length > 0) {
      slug = generateSlug();
      exists = await db
        .select()
        .from(links)
        .where(eq(links.urlCode, slug))
        .limit(1);
    }

    return slug;
  }
}
