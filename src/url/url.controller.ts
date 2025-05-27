import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Ip,
  Logger,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UrlService } from './url.service';
import { ShortenURLDto } from './dtos/url.dto';

@Controller('url')
export class UrlController {
  private readonly logger = new Logger(UrlController.name);

  constructor(private readonly urlService: UrlService) {}

  @Post('/short-url')
  async shortUrl(
    @Body() body: ShortenURLDto,
    @Ip() ip: string,
    @Res() response: Response,
  ) {
    try {
      const result = await this.urlService.shortenUrl({
        originalUrl: body.originalUrl,
        ip,
      });

      return response.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.log(`Error while trying short url: ${JSON.stringify(error)}`);
      return response
        .status(error.status ?? HttpStatus.INTERNAL_SERVER_ERROR)
        .json(error.response);
    }
  }

  @Get('/:urlCode')
  async redirect(@Param('urlCode') urlCode: string, @Res() response: Response) {
    try {
      if (!urlCode) {
        throw new NotFoundException('Link não encontrado ou expirado');
      }
      const originalUrl = await this.urlService.redirect(urlCode);
      return response.redirect(originalUrl);
    } catch (error) {
      this.logger.log(
        `Error while trying redirect to original url: ${JSON.stringify(error)}`,
      );
      return response
        .status(error.status ?? HttpStatus.INTERNAL_SERVER_ERROR)
        .json(error.response);
    }
  }

  @Get()
  async getUrlsFromIp(@Ip() ip: string, @Res() response: Response) {
    try {
      const result = await this.urlService.getUrlsWithBusiestPeriodByIp(ip);
      return response.status(HttpStatus.OK).json(result);
    } catch (error) {
      this.logger.log(`Error while getting urls: ${JSON.stringify(error)}`);
      return response
        .status(error.status ?? HttpStatus.INTERNAL_SERVER_ERROR)
        .json(error.response);
    }
  }
}
