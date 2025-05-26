import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Ip,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UrlService } from './url.service';
import { ShortenURLDto } from './dtos/url.dto';

@Controller('url')
export class UrlController {
  constructor(private readonly urlService: UrlService) {}

  @Post('/short-url')
  async shortUrl(
    @Body() body: ShortenURLDto,
    @Ip() ip: string,
    @Res() response: Response,
  ) {
    const result = await this.urlService.shortenUrl({
      originalUrl: body.originalUrl,
      ip,
    });
    return response.status(HttpStatus.OK).json(result);
  }

  @Get('/:urlCode')
  async redirect(@Param('urlCode') urlCode: string, @Res() res: Response) {
    const originalUrl = await this.urlService.redirect(urlCode);
    return res.redirect(originalUrl);
  }
}
