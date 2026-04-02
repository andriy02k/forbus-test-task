import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { CreateSymbolDto } from './dto/create-symbol.dto';
import { FindAllSymbolsDto } from './dto/find-all-symbols.dto';
import { PaginatedSymbolsResponseDto } from './dto/paginated-symbols-response.dto';
import { SymbolDto } from './dto/symbol.dto';
import { UpdateSymbolDto } from './dto/update-symbol.dto';
import { SymbolService } from './symbol.service';

@ApiTags('symbols')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@Controller('symbols')
export class SymbolController {
  constructor(private readonly symbolService: SymbolService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create symbol',
    description:
      'Admin creates a symbol and controls whether it is public for clients.',
  })
  @ApiBody({ type: CreateSymbolDto })
  @ApiOkResponse({
    description: 'Created symbol',
    type: SymbolDto,
  })
  @ApiForbiddenResponse({ description: 'Admin role is required' })
  create(@Body() createSymbolDto: CreateSymbolDto) {
    return this.symbolService.create(createSymbolDto);
  }

  @Get('all')
  @ApiOperation({
    summary: 'Get paginated symbols',
    description:
      'Returns paginated symbols. Admin sees all symbols, client sees only public symbols.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number, starts from 1',
  })
  @ApiQuery({
    name: 'count',
    required: false,
    type: Number,
    example: 10,
    description: 'Items per page',
  })
  @ApiOkResponse({
    description: 'Paginated symbols response',
    type: PaginatedSymbolsResponseDto,
  })
  findAll(
    @Query() findAllSymbolsDto: FindAllSymbolsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.symbolService.findAll(findAllSymbolsDto, user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get symbol by id',
    description:
      'Returns a single symbol. Admin can access any symbol, client only public symbols.',
  })
  @ApiParam({
    name: 'id',
    description: 'Symbol id',
    example: '660bf3706c8f8720da6f01b4',
  })
  @ApiOkResponse({
    description: 'Symbol details',
    type: SymbolDto,
  })
  @ApiNotFoundResponse({ description: 'Symbol not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.symbolService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update symbol',
    description: 'Admin updates symbol fields including publication status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Symbol id',
    example: '660bf3706c8f8720da6f01b4',
  })
  @ApiBody({ type: UpdateSymbolDto })
  @ApiOkResponse({
    description: 'Updated symbol',
    type: SymbolDto,
  })
  @ApiForbiddenResponse({ description: 'Admin role is required' })
  @ApiNotFoundResponse({ description: 'Symbol not found' })
  update(@Param('id') id: string, @Body() updateSymbolDto: UpdateSymbolDto) {
    return this.symbolService.update(id, updateSymbolDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete symbol',
    description: 'Admin deletes a symbol.',
  })
  @ApiParam({
    name: 'id',
    description: 'Symbol id',
    example: '660bf3706c8f8720da6f01b4',
  })
  @ApiOkResponse({
    description: 'Deleted symbol',
    type: SymbolDto,
  })
  @ApiForbiddenResponse({ description: 'Admin role is required' })
  @ApiNotFoundResponse({ description: 'Symbol not found' })
  remove(@Param('id') id: string) {
    return this.symbolService.remove(id);
  }
}
