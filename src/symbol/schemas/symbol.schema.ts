import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  collection: 'symbols',
  timestamps: true,
  versionKey: false,
})
export class TradingSymbol {
  @Prop({
    required: true,
    trim: true,
  })
  name: string;

  @Prop({
    required: true,
    default: false,
  })
  ['public']: boolean;

  @Prop({
    required: true,
    min: 0,
  })
  price: number;

  @Prop({
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  })
  providerSymbol: string;
}

export type TradingSymbolDocument = HydratedDocument<TradingSymbol>;
export const TradingSymbolSchema = SchemaFactory.createForClass(TradingSymbol);
