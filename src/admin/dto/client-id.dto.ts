import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class ClientIdDto {
  @ApiProperty({
    example: '660bf3706c8f8720da6f01b4',
    description: 'Client id',
  })
  @IsMongoId()
  clientId: string;
}
