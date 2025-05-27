import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import * as request from 'supertest';
import { UrlModule } from './url.module';
import { UrlService } from './url.service';

describe('UrlController (e2e)', () => {
  let app: INestApplication;

  const urlService = {
    shortenUrl: () => {
      return { shortUrl: `${process.env.BASE_URL}/H23SC` };
    },
    redirect: (urlCode: string) => {
      if (urlCode === 'H23SC') return 'https://example.com';
      if (urlCode === 'EXPIRED' || urlCode === 'NONEXISTENT') {
        throw new NotFoundException('Link not found or expired');
      }
      return null;
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [UrlModule],
    })
      .overrideProvider(UrlService)
      .useValue(urlService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/url/short-url (POST)', async () => {
    return request(app.getHttpServer())
      .post('/url/short-url')
      .send({ originalUrl: 'https://example.com' })
      .expect(200)
      .expect({
        shortUrl: `${process.env.BASE_URL}/H23SC`,
      });
  });
  it('/url/:urlCode (GET)', async () => {
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

    expect(response.body.message).toBe('Link not found or expired');
  });

  it('GET /url/:urlCode with an expired link returns 404', async () => {
    const expiredCode = 'EXPIRED';

    const response = await request(app.getHttpServer())
      .get(`/url/${expiredCode}`)
      .expect(404);

    expect(response.body.message).toBe('Link not found or expired');
  });
});
