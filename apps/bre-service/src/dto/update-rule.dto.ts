import { PartialType } from '@nestjs/swagger';
import { CreateBreRuleDto } from './create-rule.dto';

export class UpdateBreRuleDto extends PartialType(CreateBreRuleDto) {}
