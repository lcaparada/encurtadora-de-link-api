import { Module } from '@nestjs/common';
import Redis from 'ioredis';

export const redisProvider = {
  provide: 'redis',
  useValue: new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  }),
};

@Module({
  providers: [redisProvider],
  exports: ['redis'],
})
export class RedisModule {}
