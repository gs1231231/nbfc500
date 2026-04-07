import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsArray,
  Min,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateFieldDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fieldLabel?: string;

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
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  updatedBy?: string;
}
