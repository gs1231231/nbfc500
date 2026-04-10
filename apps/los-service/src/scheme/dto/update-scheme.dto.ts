import { PartialType } from '@nestjs/mapped-types';
import { CreateSchemeDto } from './create-scheme.dto';

export class UpdateSchemeDto extends PartialType(CreateSchemeDto) {}
