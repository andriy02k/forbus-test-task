import { ApiProperty } from '@nestjs/swagger';
import { SymbolDto } from './symbol.dto';

export class PaginatedSymbolsResponseDto {
  @ApiProperty({
    type: [SymbolDto],
  })
  items: SymbolDto[];

  @ApiProperty({
    example: 25,
    description: 'Total number of matched symbols',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Current page number',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Items requested per page',
  })
  count: number;

  @ApiProperty({
    example: 3,
    description: 'Last available page number',
  })
  lastPage: number;
}
