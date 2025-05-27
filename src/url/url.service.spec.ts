import { UrlService } from './url.service';
import { BadRequestException } from '@nestjs/common';
import { isURL } from 'class-validator';

jest.mock('class-validator', () => ({
  isURL: jest.fn(),
}));

describe('UrlService', () => {
  let service: UrlService;
  let dbMock: any;
  let redisMock: any;

  beforeEach(() => {
    dbMock = {
      select: jest.fn(),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({ execute: jest.fn() })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(),
        })),
      })),
    };

    redisMock = {
      incr: jest.fn(),
      expire: jest.fn(),
      hgetall: jest.fn(),
    };

    service = new UrlService(dbMock, redisMock);
  });

  describe('redirect', () => {
    it('should return originalUrl if found and not expired', async () => {
      const urlCode = 'abc123';
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10000);

      dbMock.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([
            {
              id: 1,
              originalUrl: 'https://example.com',
              expiresAt,
            },
          ]),
        }),
      });

      dbMock.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(),
        })),
      }));

      dbMock.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          execute: jest.fn(),
        })),
      }));

      const result = await service.redirect(urlCode);

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.insert).toHaveBeenCalled();
      expect(result).toBe('https://example.com');
    });

    it('should throw NotFoundException if link not found or expired', async () => {
      const urlCode = 'notfound';

      dbMock.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([]),
        }),
      });

      await expect(service.redirect(urlCode)).rejects.toThrow(
        'Link não encontrado ou expirado',
      );
    });
  });

  describe('checkIfUrlIsRegistered', () => {
    it('should throw if URL is cached as registered', async () => {
      redisMock.get = jest.fn().mockResolvedValue('1');

      await expect(
        service.checkIfUrlIsRegistered('http://test.com'),
      ).rejects.toThrow('Essa URL já está cadastrada');
      expect(redisMock.get).toHaveBeenCalledWith(
        'registered-url:http://test.com',
      );
    });

    it('should throw if URL is found in DB and cache it', async () => {
      redisMock.get = jest.fn().mockResolvedValue(null);
      dbMock.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            then: (cb: any) => cb([{ id: 1, originalUrl: 'http://test.com' }]),
          }),
        }),
      });
      redisMock.set = jest.fn();

      await expect(
        service.checkIfUrlIsRegistered('http://test.com'),
      ).rejects.toThrow('Essa URL já está cadastrada');
      expect(redisMock.set).toHaveBeenCalledWith(
        'registered-url:http://test.com',
        '1',
        'EX',
        3600,
      );
    });

    it('should cache as not registered if not found', async () => {
      redisMock.get = jest.fn().mockResolvedValue(null);
      dbMock.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            then: (cb: any) => cb([]),
          }),
        }),
      });
      redisMock.set = jest.fn();

      await service.checkIfUrlIsRegistered('http://notfound.com');
      expect(redisMock.set).toHaveBeenCalledWith(
        'registered-url:http://notfound.com',
        '0',
        'EX',
        300,
      );
    });
  });

  describe('verifyIfIpCreateFiveUrlsOrMore', () => {
    it('should throw if cached count is 5 or more', async () => {
      redisMock.get = jest.fn().mockResolvedValue('5');

      await expect(
        service.verifyIfIpCreateFiveUrlsOrMore('127.0.0.1'),
      ).rejects.toThrow('Limite de 5 URLs por IP atingido');
      expect(redisMock.get).toHaveBeenCalledWith('ip-url-count:127.0.0.1');
    });

    it('should throw if DB count is 5 or more and cache it', async () => {
      redisMock.get = jest.fn().mockResolvedValue(null);
      dbMock.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([{ count: 5 }]),
        }),
      });
      redisMock.set = jest.fn();

      await expect(
        service.verifyIfIpCreateFiveUrlsOrMore('127.0.0.1'),
      ).rejects.toThrow('Limite de 5 URLs por IP atingido');
      expect(redisMock.set).toHaveBeenCalledWith(
        'ip-url-count:127.0.0.1',
        '5',
        'EX',
        300,
      );
    });

    it('should cache count if less than 5 and not throw', async () => {
      redisMock.get = jest.fn().mockResolvedValue(null);
      dbMock.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([{ count: 2 }]),
        }),
      });
      redisMock.set = jest.fn();

      await expect(
        service.verifyIfIpCreateFiveUrlsOrMore('127.0.0.1'),
      ).resolves.toBeUndefined();
      expect(redisMock.set).toHaveBeenCalledWith(
        'ip-url-count:127.0.0.1',
        '2',
        'EX',
        300,
      );
    });
  });

  describe('shortenUrl', () => {
    it('should throw if URL is invalid', async () => {
      (isURL as jest.Mock).mockReturnValue(false);

      await expect(
        service.shortenUrl({ originalUrl: 'not-a-url', ip: '127.0.0.1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if URL already registered', async () => {
      (isURL as jest.Mock).mockReturnValue(true);

      dbMock.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            all: jest.fn().mockResolvedValue([{ urlCode: 'existing' }]),
          })),
        })),
      });

      service.checkIfUrlIsRegistered = jest
        .fn()
        .mockRejectedValue(new BadRequestException('URL já registrada'));

      await expect(
        service.shortenUrl({ originalUrl: 'http://test.com', ip: '127.0.0.1' }),
      ).rejects.toThrow('URL já registrada');
    });

    it('should throw if IP created 5 or more URLs', async () => {
      (isURL as jest.Mock).mockReturnValue(true);

      service.checkIfUrlIsRegistered = jest.fn().mockResolvedValue(undefined);
      service.verifyIfIpCreateFiveUrlsOrMore = jest
        .fn()
        .mockRejectedValue(new BadRequestException('Limite atingido'));

      await expect(
        service.shortenUrl({ originalUrl: 'http://test.com', ip: '127.0.0.1' }),
      ).rejects.toThrow('Limite atingido');
    });

    it('should create short URL successfully', async () => {
      service.shortenUrl = jest.fn().mockResolvedValue({
        shortUrl: 'http://localhost:3001/abc123',
      });

      (isURL as jest.Mock).mockReturnValue(true);

      service.checkIfUrlIsRegistered = jest.fn().mockResolvedValue(undefined);
      service.verifyIfIpCreateFiveUrlsOrMore = jest
        .fn()
        .mockResolvedValue(undefined);
      service.generateUniqueSlug = jest.fn().mockResolvedValue('abc123');

      dbMock.insert = jest.fn(() => ({
        values: jest.fn(() => ({
          execute: jest.fn().mockResolvedValue(undefined),
        })),
      }));

      const result = await service.shortenUrl({
        originalUrl: 'http://valid.com',
        ip: '127.0.0.1',
      });

      expect(result).toMatchObject({
        shortUrl: `http://localhost:3001/abc123`,
      });
    });
  });

  describe('getUrlsWithBusiestPeriodByIp', () => {
    it('should return urls and the busiest period', async () => {
      const urlsMock = [
        {
          id: 1,
          originalUrl: 'https://example.com',
          shortUrl: 'http://localhost:3001/url/abc123',
          expiresAt: new Date('2025-05-28T01:46:39.000Z'),
          accessCount: 3,
        },
      ];

      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(urlsMock),
        }),
      });

      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest
                  .fn()
                  .mockReturnValue([{ period: 'Manhã', total: 3 }]),
              }),
            }),
          }),
        }),
      });

      const result = await service.getUrlsWithBusiestPeriodByIp('127.0.0.1');

      expect(result).toEqual({
        urls: urlsMock,
        periodBusiest: 'Manhã',
      });
    });

    it('should return empty urls and null periodBusiest if no urls found', async () => {
      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([]),
        }),
      });

      const result = await service.getUrlsWithBusiestPeriodByIp('127.0.0.1');
      expect(result).toEqual({
        urls: [],
        periodBusiest: null,
      });
    });
  });
});
