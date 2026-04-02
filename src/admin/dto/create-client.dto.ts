import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({
    example: 'client@example.com',
    description: 'Client email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'client12345',
    minLength: 8,
    description: 'Client password',
  })
  @IsString()
  @MinLength(8)
  password: string;
}
