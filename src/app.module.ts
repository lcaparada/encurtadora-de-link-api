import { Module } from '@nestjs/common';

import { UrlModule } from './url/url.module';
import { DrizzleModule } from './drizzle/drizze.module';

@Module({
  imports: [UrlModule, DrizzleModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
