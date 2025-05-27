import { Module } from '@nestjs/common';
import { db } from './db';

@Module({
  providers: [
    {
      provide: 'db',
      useValue: db,
    },
  ],
  exports: ['db'],
})
export class DrizzleModule {}
