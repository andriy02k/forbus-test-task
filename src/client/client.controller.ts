import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthUserDto } from '../auth/dto/auth-user.dto';
import { UserRole } from '../auth/enums/user-role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { SymbolDto } from '../symbol/dto/symbol.dto';
import { SymbolService } from '../symbol/symbol.service';

@ApiTags('client')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({ description: 'Client role is required' })
@Controller()
export class ClientController {
  constructor(private readonly symbolService: SymbolService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current client',
    description: 'Returns the current authenticated client profile.',
  })
  @ApiOkResponse({
    description: 'Current client profile',
    type: AuthUserDto,
  })
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Get('symbols')
  @ApiOperation({
    summary: 'Get available symbols',
    description:
      'Returns the list of symbols available for client subscriptions.',
  })
  @ApiOkResponse({
    description: 'Available symbols',
    type: SymbolDto,
    isArray: true,
  })
  findAvailableSymbols() {
    return this.symbolService.findAvailableForClient();
  }
}
