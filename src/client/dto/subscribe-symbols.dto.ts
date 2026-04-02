import { ArrayUnique, IsArray, IsMongoId } from 'class-validator';

export class SubscribeSymbolsDto {
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  symbolIds: string[];
}
