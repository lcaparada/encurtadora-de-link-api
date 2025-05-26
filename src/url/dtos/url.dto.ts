import { IsString, IsNotEmpty } from 'class-validator';

export class ShortenURLDto {
  @IsString()
  @IsNotEmpty()
  originalUrl: string;
}
