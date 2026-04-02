import { Body, Controller, Delete, Post, Put, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { AdminClientDto } from './dto/admin-client.dto';
import { ClientIdDto } from './dto/client-id.dto';
import { CreateClientDto } from './dto/create-client.dto';

@ApiTags('admin')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({ description: 'Admin role is required' })
@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('create-client')
  @ApiOperation({
    summary: 'Create client',
    description: 'Admin creates a new client account.',
  })
  @ApiBody({ type: CreateClientDto })
  @ApiOkResponse({
    description: 'Created client',
    type: AdminClientDto,
  })
  create(@Body() createClientDto: CreateClientDto) {
    return this.adminService.createClient(createClientDto);
  }

  @Put('disable-socket')
  @ApiOperation({
    summary: 'Disable client socket',
    description:
      'Admin disables socket access for a client and drops active socket connections if they exist.',
  })
  @ApiBody({ type: ClientIdDto })
  @ApiOkResponse({
    description: 'Client with disabled socket access',
    type: AdminClientDto,
  })
  disableSocket(@Body() clientIdDto: ClientIdDto) {
    return this.adminService.disableSocket(clientIdDto.clientId);
  }

  @Delete('remove-client')
  @ApiOperation({
    summary: 'Remove client',
    description: 'Admin removes a client account.',
  })
  @ApiBody({ type: ClientIdDto })
  @ApiOkResponse({
    description: 'Removed client',
    type: AdminClientDto,
  })
  remove(@Body() clientIdDto: ClientIdDto) {
    return this.adminService.removeClient(clientIdDto.clientId);
  }
}
