import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';

export class AuthUserDto {
  @ApiProperty({
    example: '660bf3706c8f8720da6f01b4',
    description: 'User id',
  })
  id: string;

  @ApiProperty({
    example: 'admin@example.com',
    description: 'User email',
  })
  email: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.ADMIN,
    description: 'User role',
  })
  role: UserRole;
}
