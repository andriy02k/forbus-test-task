import {
  Inject,
  ConflictException,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, isValidObjectId } from 'mongoose';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { UserRole } from '../auth/enums/user-role.enum';
import { BinanceProviderService } from '../binance-provider/binance-provider.service';
import { CreateSymbolDto } from './dto/create-symbol.dto';
import { FindAllSymbolsDto } from './dto/find-all-symbols.dto';
import { UpdateSymbolDto } from './dto/update-symbol.dto';
import { TradingSymbol, TradingSymbolDocument } from './schemas/symbol.schema';
import { SymbolUpdatesService } from './symbol-updates.service';

@Injectable()
export class SymbolService {
  constructor(
    @InjectModel(TradingSymbol.name)
    private readonly symbolModel: Model<TradingSymbolDocument>,
    private readonly symbolUpdatesService: SymbolUpdatesService,
    @Inject(forwardRef(() => BinanceProviderService))
    private readonly binanceProviderService: BinanceProviderService,
  ) {}

  async create(createSymbolDto: CreateSymbolDto) {
    try {
      const symbol = await this.symbolModel.create(
        this.normalizeCreateSymbolDto(createSymbolDto),
      );
      const symbolDto = this.toDto(symbol);
      this.binanceProviderService.upsertSymbol(symbolDto);
      return symbolDto;
    } catch (error) {
      this.handleDuplicateProviderSymbol(error);
    }
  }

  async findAll(findAllSymbolsDto: FindAllSymbolsDto, user: RequestUser) {
    const page = findAllSymbolsDto.page ?? 1;
    const count = findAllSymbolsDto.count ?? 10;
    const filter = this.buildFilterForUser(user);
    const skip = (page - 1) * count;

    const [items, total] = await Promise.all([
      this.symbolModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(count),
      this.symbolModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this.toDto(item)),
      total,
      page,
      count,
      lastPage: Math.ceil(total / count),
    };
  }

  async findOne(id: string, user: RequestUser) {
    const symbol = await this.findSymbolOrThrow(id, user);
    return this.toDto(symbol);
  }

  async findAvailableForClient() {
    const symbols = await this.symbolModel
      .find({ public: true })
      .sort({ createdAt: -1 });

    return symbols.map((symbol) => this.toDto(symbol));
  }

  async update(id: string, updateSymbolDto: UpdateSymbolDto) {
    this.validateId(id);

    const symbol = await this.symbolModel.findById(id);

    if (!symbol) {
      throw new NotFoundException('Symbol not found');
    }

    const previousSymbolDto = this.toDto(symbol);
    const previousPrice = symbol.price;

    symbol.set(this.normalizeUpdateSymbolDto(updateSymbolDto));

    try {
      await symbol.save();
    } catch (error) {
      this.handleDuplicateProviderSymbol(error);
      throw error;
    }

    const symbolDto = this.toDto(symbol);

    if (symbolDto.public && symbolDto.price !== previousPrice) {
      this.symbolUpdatesService.publishPriceUpdate(symbolDto);
    }

    this.binanceProviderService.syncSymbol(previousSymbolDto, symbolDto);

    return symbolDto;
  }

  async remove(id: string) {
    this.validateId(id);

    const symbol = await this.symbolModel.findByIdAndDelete(id);

    if (!symbol) {
      throw new NotFoundException('Symbol not found');
    }

    const symbolDto = this.toDto(symbol);
    this.binanceProviderService.removeTrackedSymbol(symbolDto);
    return symbolDto;
  }

  private async findSymbolOrThrow(id: string, user: RequestUser) {
    this.validateId(id);

    const filter: FilterQuery<TradingSymbolDocument> = {
      _id: id,
      ...this.buildFilterForUser(user),
    };

    const symbol = await this.symbolModel.findOne(filter);

    if (!symbol) {
      throw new NotFoundException('Symbol not found');
    }

    return symbol;
  }

  private buildFilterForUser(
    user: RequestUser,
  ): FilterQuery<TradingSymbolDocument> {
    if (user.role === UserRole.ADMIN) {
      return {};
    }

    return { public: true };
  }

  private toDto(symbol: TradingSymbolDocument) {
    return {
      id: symbol.id,
      name: symbol.name,
      public: symbol.public,
      price: symbol.price,
      providerSymbol: this.normalizeProviderSymbol(symbol.providerSymbol),
    };
  }

  private normalizeCreateSymbolDto(createSymbolDto: CreateSymbolDto) {
    return {
      ...createSymbolDto,
      providerSymbol: this.normalizeProviderSymbol(
        createSymbolDto.providerSymbol,
      ),
    };
  }

  private normalizeUpdateSymbolDto(updateSymbolDto: UpdateSymbolDto) {
    if (!updateSymbolDto.providerSymbol) {
      return updateSymbolDto;
    }

    return {
      ...updateSymbolDto,
      providerSymbol: this.normalizeProviderSymbol(
        updateSymbolDto.providerSymbol,
      ),
    };
  }

  private normalizeProviderSymbol(providerSymbol: string) {
    return providerSymbol.trim().toUpperCase();
  }

  private validateId(id: string) {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Symbol not found');
    }
  }

  private handleDuplicateProviderSymbol(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException(
        'Symbol with this providerSymbol already exists',
      );
    }

    throw error;
  }
}
