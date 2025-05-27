import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as request from 'supertest';
import { UrlModule } from './url.module';
import { UrlService } from './url.service';

describe('UrlController (e2e)', () => {
  let app: INestApplication;

  const urlService = {
    shortenUrl: ({ originalUrl }: { originalUrl: string }) => {
      if (!originalUrl || typeof originalUrl !== 'string') {
        throw new BadRequestException('Esse texto deve ser uma url válida.');
      }
      if (!/^https?:\/\/.+\..+/.test(originalUrl)) {
        throw new BadRequestException('Esse texto deve ser uma url válida.');
      }
      return { shortUrl: `${process.env.BASE_URL}/H23SC` };
    },
    redirect: (urlCode: string) => {
      if (urlCode === 'H23SC') return 'https://example.com';
      if (urlCode === 'EXPIRED' || urlCode === 'NONEXISTENT') {
        throw new NotFoundException('Link não encontrado ou expirado');
      }
      return null;
    },
    getUrlsWithBusiestPeriodByIp: () => {
      return {
        urls: [
          {
            id: 1,
            originalUrl: 'https://example.com',
            shortUrl: 'http://localhost:3001/url/abc123',
            expiresAt: '2025-05-28T01:46:39.000Z',
            accessCount: 3,
          },
        ],
        periodBusiest: 'Manhã',
      };
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [UrlModule],
    })
      .overrideProvider(UrlService)
      .useValue(urlService)
      .overrideProvider('db')
      .useValue({})
      .overrideProvider('redis')
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/url/short-url (POST) should return a short url', async () => {
    return request(app.getHttpServer())
      .post('/url/short-url')
      .send({ originalUrl: 'https://example.com' })
      .expect(200)
      .expect({
        shortUrl: `${process.env.BASE_URL}/H23SC`,
      });
  });

  it('/url/short-url (POST) with invalid url returns 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/url/short-url')
      .send({ originalUrl: 'invalid-url' })
      .expect(400);

    expect(response.body.message).toBe('Esse texto deve ser uma url válida.');
  });

  it('GET /url returns urls and periodBusiest', async () => {
    urlService.getUrlsWithBusiestPeriodByIp = jest.fn().mockResolvedValue({
      urls: [
        {
          id: 1,
          originalUrl: 'https://example.com',
          shortUrl: 'http://localhost:3001/url/abc123',
          expiresAt: '2025-05-28T01:46:39.000Z',
          accessCount: 3,
        },
      ],
      periodBusiest: 'Manhã',
    });

    const response = await request(app.getHttpServer()).get('/url').expect(200);

    expect(response.body).toEqual({
      urls: [
        {
          id: 1,
          originalUrl: 'https://example.com',
          shortUrl: 'http://localhost:3001/url/abc123',
          expiresAt: '2025-05-28T01:46:39.000Z',
          accessCount: 3,
        },
      ],
      periodBusiest: 'Manhã',
    });
    expect(urlService.getUrlsWithBusiestPeriodByIp).toHaveBeenCalled();
  });

  it('/url/short-url (POST) with missing url returns 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/url/short-url')
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Esse texto deve ser uma url válida.');
  });

  it('/url/:urlCode (GET) should redirect to original url', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/url/short-url')
      .send({ originalUrl: 'https://example.com' })
      .expect(200);

    const shortUrl = body.shortUrl;
    const urlCode = shortUrl.split('/').pop();

    const response = await request(app.getHttpServer())
      .get(`/url/${urlCode}`)
      .expect(302);

    expect(response.headers.location).toBe('https://example.com');
  });

  it('GET /url/:urlCode with an invalid code returns 404', async () => {
    const response = await request(app.getHttpServer())
      .get('/url/NONEXISTENT')
      .expect(404);

    expect(response.body.message).toBe('Link não encontrado ou expirado');
  });

  it('GET /url/:urlCode with an expired link returns 404', async () => {
    const expiredCode = 'EXPIRED';

    const response = await request(app.getHttpServer())
      .get(`/url/${expiredCode}`)
      .expect(404);

    expect(response.body.message).toBe('Link não encontrado ou expirado');
  });

  it('POST /url/short-url with non-string url returns 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/url/short-url')
      .send({ originalUrl: 12345 })
      .expect(400);

    expect(response.body.message).toBe('Esse texto deve ser uma url válida.');
  });

  it('GET /url returns urls and periodBusiest', async () => {
    const response = await request(app.getHttpServer()).get('/url').expect(200);

    expect(response.body).toEqual({
      urls: [
        {
          id: 1,
          originalUrl: 'https://example.com',
          shortUrl: 'http://localhost:3001/url/abc123',
          expiresAt: '2025-05-28T01:46:39.000Z',
          accessCount: 3,
        },
      ],
      periodBusiest: 'Manhã',
    });
    expect(urlService.getUrlsWithBusiestPeriodByIp).toHaveBeenCalled();
  });
});
