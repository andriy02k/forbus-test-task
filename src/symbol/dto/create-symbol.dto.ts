import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsString, Min } from 'class-validator';

export class CreateSymbolDto {
  @ApiProperty({
    example: 'Bitcoin',
    description: 'Display name for the symbol',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: true,
    description: 'Whether the symbol is visible for clients',
  })
  @IsBoolean()
  ['public']: boolean;

  @ApiProperty({
    example: 62000,
    description: 'Current symbol price',
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    example: 'BTCUSDT',
    description: 'Provider symbol identifier',
  })
  @IsString()
  providerSymbol: string;
}
