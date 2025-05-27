import { Module } from '@nestjs/common';
import { UrlService } from './url.service';
import { UrlController } from './url.controller';
import { DrizzleModule } from '../drizzle/drizze.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  providers: [UrlService],
  controllers: [UrlController],
  imports: [DrizzleModule, RedisModule],
})
export class UrlModule {}
