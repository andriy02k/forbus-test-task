import { ApiProperty } from '@nestjs/swagger';
import { AuthUserDto } from '../../auth/dto/auth-user.dto';

export class AdminClientDto extends AuthUserDto {
  @ApiProperty({
    example: false,
    description: 'Whether socket access is disabled for the client',
  })
  socketDisabled: boolean;
}
