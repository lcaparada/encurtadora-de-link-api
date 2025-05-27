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
    };

    redisMock = {
      incr: jest.fn(),
      expire: jest.fn(),
    };

    service = new UrlService(dbMock, redisMock);
  });

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
