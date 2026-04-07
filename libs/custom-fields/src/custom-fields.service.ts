import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@bankos/database';
import { CreateFieldDto, EntityType } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';

// Regex patterns for specialized field types
const PHONE_REGEX = /^[6-9]\d{9}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^\d{12}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FormField {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  isRequired: boolean;
  isSearchable: boolean;
  isVisibleInList: boolean;
  enumOptions: string[] | null;
  defaultValue: string | null;
  validationRule: Record<string, unknown> | null;
  displayOrder: number;
  sectionName: string | null;
}

export interface FormSection {
  sectionName: string;
  fields: FormField[];
}

export interface FormSchema {
  entityType: string;
  sections: FormSection[];
  ungroupedFields: FormField[];
}

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Define a new custom field for a tenant/entity-type combination.
   */
  async defineField(orgId: string, dto: CreateFieldDto) {
    // Validate ENUM type must have enumOptions
    if (dto.fieldType === 'ENUM') {
      if (!dto.enumOptions || dto.enumOptions.length === 0) {
        throw new BadRequestException(
          'enumOptions is required for ENUM field type',
        );
      }
    }

    try {
      return await this.prisma.customFieldDefinition.create({
        data: {
          organizationId: orgId,
          entityType: dto.entityType,
          fieldKey: dto.fieldKey,
          fieldLabel: dto.fieldLabel,
          fieldType: dto.fieldType,
          isRequired: dto.isRequired ?? false,
          isSearchable: dto.isSearchable ?? false,
          isVisibleInList: dto.isVisibleInList ?? false,
          enumOptions: dto.enumOptions ? dto.enumOptions : undefined,
          defaultValue: dto.defaultValue,
          validationRule: dto.validationRule
            ? (dto.validationRule as unknown as Prisma.InputJsonValue)
            : undefined,
          displayOrder: dto.displayOrder ?? 0,
          sectionName: dto.sectionName,
          isActive: true,
          createdBy: dto.createdBy,
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          `A field with key '${dto.fieldKey}' already exists for entity type '${dto.entityType}'`,
        );
      }
      throw error;
    }
  }

  /**
   * List all active custom field definitions for an org + entity type.
   */
  async getFieldDefinitions(orgId: string, entityType: EntityType) {
    return this.prisma.customFieldDefinition.findMany({
      where: {
        organizationId: orgId,
        entityType,
        isActive: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Update an existing field definition.
   */
  async updateField(orgId: string, fieldId: string, dto: UpdateFieldDto) {
    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { id: fieldId, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Custom field definition '${fieldId}' not found`,
      );
    }

    return this.prisma.customFieldDefinition.update({
      where: { id: fieldId },
      data: {
        ...(dto.fieldLabel !== undefined && { fieldLabel: dto.fieldLabel }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.isSearchable !== undefined && {
          isSearchable: dto.isSearchable,
        }),
        ...(dto.isVisibleInList !== undefined && {
          isVisibleInList: dto.isVisibleInList,
        }),
        ...(dto.enumOptions !== undefined && { enumOptions: dto.enumOptions }),
        ...(dto.defaultValue !== undefined && {
          defaultValue: dto.defaultValue,
        }),
        ...(dto.validationRule !== undefined && {
          validationRule: dto.validationRule as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.sectionName !== undefined && { sectionName: dto.sectionName }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.updatedBy !== undefined && { updatedBy: dto.updatedBy }),
      },
    });
  }

  /**
   * Soft-delete (deactivate) a custom field definition.
   */
  async deactivateField(orgId: string, fieldId: string) {
    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { id: fieldId, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Custom field definition '${fieldId}' not found`,
      );
    }

    return this.prisma.customFieldDefinition.update({
      where: { id: fieldId },
      data: { isActive: false },
    });
  }

  /**
   * Validate custom field values against all active definitions for
   * the given org + entity type. Returns {isValid, errors[]} summary.
   */
  async validateCustomFieldValues(
    orgId: string,
    entityType: EntityType,
    values: Record<string, unknown>,
  ): Promise<ValidationResult> {
    const definitions = await this.getFieldDefinitions(orgId, entityType);
    const errors: string[] = [];

    for (const def of definitions) {
      const raw = values[def.fieldKey];

      // Required check
      if (def.isRequired && (raw === undefined || raw === null || raw === '')) {
        errors.push(`Field '${def.fieldLabel}' (${def.fieldKey}) is required`);
        continue; // skip further checks for this field if missing
      }

      // If field is not present and not required, skip
      if (raw === undefined || raw === null) {
        continue;
      }

      const value = raw;
      const fieldErrors = this.validateFieldValue(def, value);
      errors.push(...fieldErrors);
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate a single field value against its definition.
   */
  private validateFieldValue(
    def: {
      fieldKey: string;
      fieldLabel: string;
      fieldType: string;
      enumOptions: unknown;
      validationRule: unknown;
    },
    value: unknown,
  ): string[] {
    const errors: string[] = [];
    const label = `'${def.fieldLabel}' (${def.fieldKey})`;
    const rule = def.validationRule as Record<string, unknown> | null;

    switch (def.fieldType) {
      case 'STRING':
      case 'TEXTAREA': {
        if (typeof value !== 'string') {
          errors.push(`${label} must be a string`);
          break;
        }
        if (rule) {
          if (
            rule['minLength'] !== undefined &&
            value.length < (rule['minLength'] as number)
          ) {
            errors.push(
              `${label} must be at least ${rule['minLength']} characters`,
            );
          }
          if (
            rule['maxLength'] !== undefined &&
            value.length > (rule['maxLength'] as number)
          ) {
            errors.push(
              `${label} must be at most ${rule['maxLength']} characters`,
            );
          }
          if (rule['regex'] !== undefined) {
            const re = new RegExp(rule['regex'] as string);
            if (!re.test(value)) {
              errors.push(`${label} does not match required format`);
            }
          }
        }
        break;
      }

      case 'NUMBER':
      case 'CURRENCY':
      case 'PERCENTAGE': {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (typeof num !== 'number' || isNaN(num)) {
          errors.push(`${label} must be a number`);
          break;
        }
        if (def.fieldType === 'CURRENCY' && num < 0) {
          errors.push(`${label} must be a non-negative number`);
          break;
        }
        if (rule) {
          if (rule['min'] !== undefined && num < (rule['min'] as number)) {
            errors.push(`${label} must be at least ${rule['min']}`);
          }
          if (rule['max'] !== undefined && num > (rule['max'] as number)) {
            errors.push(`${label} must be at most ${rule['max']}`);
          }
        }
        break;
      }

      case 'DATE': {
        if (typeof value !== 'string' || !ISO_DATE_REGEX.test(value)) {
          errors.push(`${label} must be a valid ISO date string`);
        }
        break;
      }

      case 'BOOLEAN': {
        if (typeof value !== 'boolean') {
          errors.push(`${label} must be a boolean`);
        }
        break;
      }

      case 'ENUM': {
        const options = Array.isArray(def.enumOptions) ? def.enumOptions : [];
        if (!options.includes(value as string)) {
          errors.push(
            `${label} must be one of: ${(options as string[]).join(', ')}`,
          );
        }
        break;
      }

      case 'PHONE': {
        if (typeof value !== 'string' || !PHONE_REGEX.test(value)) {
          errors.push(
            `${label} must be a valid 10-digit Indian mobile number starting with 6-9`,
          );
        }
        break;
      }

      case 'EMAIL': {
        if (typeof value !== 'string' || !EMAIL_REGEX.test(value)) {
          errors.push(`${label} must be a valid email address`);
        }
        break;
      }

      case 'PAN': {
        if (typeof value !== 'string' || !PAN_REGEX.test(value)) {
          errors.push(`${label} must be a valid PAN number (e.g. ABCDE1234F)`);
        }
        break;
      }

      case 'AADHAAR': {
        if (typeof value !== 'string' || !AADHAAR_REGEX.test(value)) {
          errors.push(`${label} must be a valid 12-digit Aadhaar number`);
        }
        break;
      }

      default: {
        // Unknown type — no validation
        break;
      }
    }

    return errors;
  }

  /**
   * Build a Prisma JSON path filter for searching across all searchable
   * custom fields of the given entity type.
   * Returns a `where` clause fragment that can be merged with other conditions.
   */
  async buildSearchFilter(
    orgId: string,
    entityType: EntityType,
    searchTerm: string,
  ): Promise<object> {
    const definitions = await this.getFieldDefinitions(orgId, entityType);
    const searchableFields = definitions.filter((d) => d.isSearchable);

    if (searchableFields.length === 0 || !searchTerm.trim()) {
      return {};
    }

    // Build OR conditions for each searchable STRING/TEXTAREA/PHONE/EMAIL/PAN/AADHAAR field
    const stringLikeTypes = [
      'STRING',
      'TEXTAREA',
      'PHONE',
      'EMAIL',
      'PAN',
      'AADHAAR',
    ];

    const orConditions = searchableFields
      .filter((f) => stringLikeTypes.includes(f.fieldType))
      .map((f) => ({
        customFields: {
          path: [f.fieldKey],
          string_contains: searchTerm,
        },
      }));

    if (orConditions.length === 0) return {};

    return { OR: orConditions };
  }

  /**
   * Return a JSON schema suitable for dynamic frontend form rendering,
   * grouped by sectionName (ungrouped fields returned separately).
   */
  async getFormSchema(orgId: string, entityType: EntityType): Promise<FormSchema> {
    const definitions = await this.getFieldDefinitions(orgId, entityType);

    const toFormField = (def: (typeof definitions)[0]): FormField => ({
      fieldKey: def.fieldKey,
      fieldLabel: def.fieldLabel,
      fieldType: def.fieldType,
      isRequired: def.isRequired,
      isSearchable: def.isSearchable,
      isVisibleInList: def.isVisibleInList,
      enumOptions: Array.isArray(def.enumOptions)
        ? (def.enumOptions as string[])
        : null,
      defaultValue: def.defaultValue,
      validationRule: def.validationRule as Record<string, unknown> | null,
      displayOrder: def.displayOrder,
      sectionName: def.sectionName,
    });

    const grouped = new Map<string, FormField[]>();
    const ungrouped: FormField[] = [];

    for (const def of definitions) {
      const field = toFormField(def);
      if (def.sectionName) {
        if (!grouped.has(def.sectionName)) {
          grouped.set(def.sectionName, []);
        }
        grouped.get(def.sectionName)!.push(field);
      } else {
        ungrouped.push(field);
      }
    }

    const sections: FormSection[] = Array.from(grouped.entries()).map(
      ([sectionName, fields]) => ({ sectionName, fields }),
    );

    return { entityType, sections, ungroupedFields: ungrouped };
  }
}
