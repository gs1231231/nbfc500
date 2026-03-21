import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';

/**
 * Update DTO — all fields optional. PAN/Aadhaar requirement check is dropped
 * for updates (they are already captured at creation). customerType is also
 * excluded because changing entity type after creation is a business process
 * that requires additional validations beyond a simple PATCH.
 */
export class UpdateCustomerDto extends PartialType(
  OmitType(CreateCustomerDto, ['customerType'] as const),
) {}
