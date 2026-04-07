import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsIn,
  IsArray,
  Min,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';

export const ENTITY_TYPES = [
  'CUSTOMER',
  'LOAN_APPLICATION',
  'LOAN',
  'COLLECTION_TASK',
  'DSA',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const FIELD_TYPES = [
  'STRING',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'ENUM',
  'PHONE',
  'EMAIL',
  'PAN',
  'AADHAAR',
  'TEXTAREA',
  'CURRENCY',
  'PERCENTAGE',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export class CreateFieldDto {
  @IsString()
  @IsIn(ENTITY_TYPES)
  entityType!: EntityType;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fieldKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fieldLabel!: string;

  @IsString()
  @IsIn(FIELD_TYPES)
  fieldType!: FieldType;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @IsOptional()
  @IsBoolean()
  isVisibleInList?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enumOptions?: string[];

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsObject()
  validationRule?: {
    min?: number;
    max?: number;
    regex?: string;
    minLength?: number;
    maxLength?: number;
  };

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sectionName?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
