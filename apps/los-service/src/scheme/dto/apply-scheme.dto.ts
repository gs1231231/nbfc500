import { IsUUID } from 'class-validator';

export class ApplySchemeDto {
  @IsUUID()
  schemeId!: string;
}
