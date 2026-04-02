import { ApiProperty } from '@nestjs/swagger';

export class SymbolDto {
  @ApiProperty({
    example: '660bf3706c8f8720da6f01b4',
    description: 'Symbol id',
  })
  id: string;

  @ApiProperty({
    example: 'Bitcoin',
    description: 'Display name for the symbol',
  })
  name: string;

  @ApiProperty({
    example: true,
    description: 'Whether the symbol is visible for clients',
  })
  ['public']: boolean;

  @ApiProperty({
    example: 62000,
    description: 'Current symbol price',
  })
  price: number;

  @ApiProperty({
    example: 'BTCUSDT',
    description: 'Provider symbol identifier',
  })
  providerSymbol: string;
}
