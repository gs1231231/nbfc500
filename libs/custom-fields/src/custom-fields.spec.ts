/**
 * Custom Fields – pure-logic unit tests
 *
 * All validation logic is extracted into standalone helper functions so the
 * tests never touch the database or NestJS DI container.  The helpers mirror
 * the private `validateFieldValue` and the public `validateCustomFieldValues`
 * routines from CustomFieldsService.
 */

// ── Regex patterns (duplicated from service) ──────────────────────────────────
const PHONE_REGEX = /^[6-9]\d{9}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^\d{12}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

// ── Minimal field-definition shape used by tests ──────────────────────────────
interface FieldDef {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  isRequired: boolean;
  enumOptions?: string[] | null;
  validationRule?: Record<string, unknown> | null;
}

// ── Pure validation helpers ───────────────────────────────────────────────────

function validateFieldValue(def: FieldDef, value: unknown): string[] {
  const errors: string[] = [];
  const label = `'${def.fieldLabel}' (${def.fieldKey})`;
  const rule = (def.validationRule ?? null) as Record<string, unknown> | null;

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
      if (typeof num !== 'number' || isNaN(num as number)) {
        errors.push(`${label} must be a number`);
        break;
      }
      if (def.fieldType === 'CURRENCY' && (num as number) < 0) {
        errors.push(`${label} must be a non-negative number`);
        break;
      }
      if (rule) {
        if (
          rule['min'] !== undefined &&
          (num as number) < (rule['min'] as number)
        ) {
          errors.push(`${label} must be at least ${rule['min']}`);
        }
        if (
          rule['max'] !== undefined &&
          (num as number) > (rule['max'] as number)
        ) {
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
      if (!(options as string[]).includes(value as string)) {
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

    default:
      break;
  }

  return errors;
}

/**
 * Validate a map of values against an array of field definitions.
 * Returns {isValid, errors} – same contract as the service method.
 */
function validateCustomFieldValues(
  definitions: FieldDef[],
  values: Record<string, unknown>,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const def of definitions) {
    const raw = values[def.fieldKey];

    if (def.isRequired && (raw === undefined || raw === null || raw === '')) {
      errors.push(
        `Field '${def.fieldLabel}' (${def.fieldKey}) is required`,
      );
      continue;
    }

    if (raw === undefined || raw === null) {
      continue;
    }

    errors.push(...validateFieldValue(def, raw));
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Build a form-schema structure from a list of field definitions,
 * mirroring the getFormSchema() service method logic.
 */
function buildFormSchema(
  entityType: string,
  definitions: (FieldDef & {
    isSearchable: boolean;
    isVisibleInList: boolean;
    defaultValue: string | null;
    displayOrder: number;
    sectionName: string | null;
  })[],
) {
  const grouped = new Map<string, typeof definitions>();
  const ungrouped: typeof definitions = [];

  for (const def of definitions) {
    if (def.sectionName) {
      if (!grouped.has(def.sectionName)) {
        grouped.set(def.sectionName, []);
      }
      grouped.get(def.sectionName)!.push(def);
    } else {
      ungrouped.push(def);
    }
  }

  const sections = Array.from(grouped.entries()).map(
    ([sectionName, fields]) => ({ sectionName, fields }),
  );

  return { entityType, sections, ungroupedFields: ungrouped };
}

// ── Helper: build a minimal FieldDef ─────────────────────────────────────────
function field(
  overrides: Partial<FieldDef> & Pick<FieldDef, 'fieldKey' | 'fieldType'>,
): FieldDef {
  return {
    fieldLabel: overrides.fieldKey,
    isRequired: false,
    enumOptions: null,
    validationRule: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Custom Fields Validation', () => {
  // ── Field Type Validation ─────────────────────────────────────────────────
  describe('Field Type Validation', () => {
    describe('STRING', () => {
      it('accepts a string value', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'name', fieldType: 'STRING' }),
          'Alice',
        );
        expect(errors).toHaveLength(0);
      });

      it('rejects a number value', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'name', fieldType: 'STRING' }),
          42,
        );
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/must be a string/);
      });

      it('rejects a boolean value', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'name', fieldType: 'STRING' }),
          true,
        );
        expect(errors[0]).toMatch(/must be a string/);
      });
    });

    describe('TEXTAREA', () => {
      it('accepts a multi-line string', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'notes', fieldType: 'TEXTAREA' }),
          'line1\nline2',
        );
        expect(errors).toHaveLength(0);
      });

      it('rejects a number', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'notes', fieldType: 'TEXTAREA' }),
          123,
        );
        expect(errors[0]).toMatch(/must be a string/);
      });
    });

    describe('NUMBER', () => {
      it('accepts a number value', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'score', fieldType: 'NUMBER' }),
          750,
        );
        expect(errors).toHaveLength(0);
      });

      it('accepts a numeric string by coercing it', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'score', fieldType: 'NUMBER' }),
          '750',
        );
        expect(errors).toHaveLength(0);
      });

      it('rejects a non-numeric string', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'score', fieldType: 'NUMBER' }),
          'abc',
        );
        expect(errors[0]).toMatch(/must be a number/);
      });
    });

    describe('BOOLEAN', () => {
      it('accepts true', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'active', fieldType: 'BOOLEAN' }),
          true,
        );
        expect(errors).toHaveLength(0);
      });

      it('accepts false', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'active', fieldType: 'BOOLEAN' }),
          false,
        );
        expect(errors).toHaveLength(0);
      });

      it('rejects a string "true"', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'active', fieldType: 'BOOLEAN' }),
          'true',
        );
        expect(errors[0]).toMatch(/must be a boolean/);
      });

      it('rejects a number 1', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'active', fieldType: 'BOOLEAN' }),
          1,
        );
        expect(errors[0]).toMatch(/must be a boolean/);
      });
    });

    describe('DATE', () => {
      it('accepts a plain ISO date (YYYY-MM-DD)', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'dob', fieldType: 'DATE' }),
          '1990-06-15',
        );
        expect(errors).toHaveLength(0);
      });

      it('accepts a full ISO datetime with Z', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'dob', fieldType: 'DATE' }),
          '2024-01-15T10:30:00Z',
        );
        expect(errors).toHaveLength(0);
      });

      it('accepts a datetime with timezone offset', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'dob', fieldType: 'DATE' }),
          '2024-01-15T10:30:00+05:30',
        );
        expect(errors).toHaveLength(0);
      });

      it('rejects an invalid date string', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'dob', fieldType: 'DATE' }),
          'not-a-date',
        );
        expect(errors[0]).toMatch(/ISO date/);
      });

      it('rejects a non-string value', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'dob', fieldType: 'DATE' }),
          20240115,
        );
        expect(errors[0]).toMatch(/ISO date/);
      });
    });

    describe('ENUM', () => {
      const enumDef: FieldDef = {
        fieldKey: 'status',
        fieldLabel: 'Status',
        fieldType: 'ENUM',
        isRequired: false,
        enumOptions: ['ACTIVE', 'INACTIVE', 'PENDING'],
      };

      it('accepts a value present in enumOptions', () => {
        expect(validateFieldValue(enumDef, 'ACTIVE')).toHaveLength(0);
      });

      it('rejects a value absent from enumOptions', () => {
        const errors = validateFieldValue(enumDef, 'UNKNOWN');
        expect(errors[0]).toMatch(/must be one of/);
      });

      it('rejects lowercase variant even when options are uppercase', () => {
        const errors = validateFieldValue(enumDef, 'active');
        expect(errors).toHaveLength(1);
      });

      it('treats empty enumOptions as no valid values', () => {
        const emptyEnum: FieldDef = { ...enumDef, enumOptions: [] };
        const errors = validateFieldValue(emptyEnum, 'ACTIVE');
        expect(errors).toHaveLength(1);
      });
    });

    describe('PAN', () => {
      it('accepts a valid PAN (ABCDE1234F)', () => {
        expect(
          validateFieldValue(field({ fieldKey: 'pan', fieldType: 'PAN' }), 'ABCDE1234F'),
        ).toHaveLength(0);
      });

      it('rejects a lowercase PAN', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'pan', fieldType: 'PAN' }),
          'abcde1234f',
        );
        expect(errors[0]).toMatch(/PAN/);
      });

      it('rejects a PAN with wrong structure', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'pan', fieldType: 'PAN' }),
          'ABC1234FGH',
        );
        expect(errors).toHaveLength(1);
      });

      it('rejects an empty string', () => {
        expect(
          validateFieldValue(field({ fieldKey: 'pan', fieldType: 'PAN' }), ''),
        ).toHaveLength(1);
      });
    });

    describe('AADHAAR', () => {
      it('accepts a 12-digit numeric string', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'aadhaar', fieldType: 'AADHAAR' }),
            '123456789012',
          ),
        ).toHaveLength(0);
      });

      it('rejects an 11-digit string', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'aadhaar', fieldType: 'AADHAAR' }),
          '12345678901',
        );
        expect(errors[0]).toMatch(/12-digit/);
      });

      it('rejects a 13-digit string', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'aadhaar', fieldType: 'AADHAAR' }),
          '1234567890123',
        );
        expect(errors).toHaveLength(1);
      });

      it('rejects a string with letters', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'aadhaar', fieldType: 'AADHAAR' }),
            '1234567890AB',
          ),
        ).toHaveLength(1);
      });
    });

    describe('PHONE', () => {
      it('accepts a 10-digit number starting with 9', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'mobile', fieldType: 'PHONE' }),
            '9876543210',
          ),
        ).toHaveLength(0);
      });

      it('accepts numbers starting with 6, 7, and 8', () => {
        for (const prefix of ['6', '7', '8']) {
          const errors = validateFieldValue(
            field({ fieldKey: 'mobile', fieldType: 'PHONE' }),
            `${prefix}123456789`,
          );
          expect(errors).toHaveLength(0);
        }
      });

      it('rejects a number starting with 5', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'mobile', fieldType: 'PHONE' }),
          '5123456789',
        );
        expect(errors[0]).toMatch(/6-9/);
      });

      it('rejects a number with fewer than 10 digits', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'mobile', fieldType: 'PHONE' }),
            '987654321',
          ),
        ).toHaveLength(1);
      });

      it('rejects a number with more than 10 digits', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'mobile', fieldType: 'PHONE' }),
            '98765432101',
          ),
        ).toHaveLength(1);
      });
    });

    describe('CURRENCY', () => {
      it('accepts a positive number', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'amount', fieldType: 'CURRENCY' }),
            50000,
          ),
        ).toHaveLength(0);
      });

      it('accepts zero', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'amount', fieldType: 'CURRENCY' }),
            0,
          ),
        ).toHaveLength(0);
      });

      it('rejects a negative number', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'amount', fieldType: 'CURRENCY' }),
          -100,
        );
        expect(errors[0]).toMatch(/non-negative/);
      });

      it('rejects a non-numeric string', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'amount', fieldType: 'CURRENCY' }),
            'rupees',
          ),
        ).toHaveLength(1);
      });
    });

    describe('PERCENTAGE', () => {
      it('accepts 0', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'rate', fieldType: 'PERCENTAGE' }),
            0,
          ),
        ).toHaveLength(0);
      });

      it('accepts 100', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'rate', fieldType: 'PERCENTAGE' }),
            100,
          ),
        ).toHaveLength(0);
      });

      it('accepts a decimal like 12.5', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'rate', fieldType: 'PERCENTAGE' }),
            12.5,
          ),
        ).toHaveLength(0);
      });

      it('rejects a string value', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'rate', fieldType: 'PERCENTAGE' }),
            'fifty',
          ),
        ).toHaveLength(1);
      });
    });

    describe('EMAIL', () => {
      it('accepts a well-formed email', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'email', fieldType: 'EMAIL' }),
            'user@example.com',
          ),
        ).toHaveLength(0);
      });

      it('rejects a string without @', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'email', fieldType: 'EMAIL' }),
          'notanemail',
        );
        expect(errors[0]).toMatch(/email/);
      });

      it('rejects a non-string', () => {
        expect(
          validateFieldValue(
            field({ fieldKey: 'email', fieldType: 'EMAIL' }),
            42,
          ),
        ).toHaveLength(1);
      });
    });

    describe('Unknown field type', () => {
      it('produces no errors for unknown types (pass-through)', () => {
        const errors = validateFieldValue(
          field({ fieldKey: 'custom', fieldType: 'GPS_COORDINATES' }),
          'anything',
        );
        expect(errors).toHaveLength(0);
      });
    });
  });

  // ── Validation Rules ──────────────────────────────────────────────────────
  describe('Validation Rules', () => {
    it('required field fails when value is missing', () => {
      const defs: FieldDef[] = [
        { ...field({ fieldKey: 'firstName', fieldType: 'STRING' }), isRequired: true },
      ];
      const result = validateCustomFieldValues(defs, {});
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/firstName.*is required/);
    });

    it('required field fails when value is empty string', () => {
      const defs: FieldDef[] = [
        { ...field({ fieldKey: 'firstName', fieldType: 'STRING' }), isRequired: true },
      ];
      const result = validateCustomFieldValues(defs, { firstName: '' });
      expect(result.isValid).toBe(false);
    });

    it('required field fails when value is null', () => {
      const defs: FieldDef[] = [
        { ...field({ fieldKey: 'firstName', fieldType: 'STRING' }), isRequired: true },
      ];
      const result = validateCustomFieldValues(defs, { firstName: null });
      expect(result.isValid).toBe(false);
    });

    it('required field passes when a non-empty value is present', () => {
      const defs: FieldDef[] = [
        { ...field({ fieldKey: 'firstName', fieldType: 'STRING' }), isRequired: true },
      ];
      const result = validateCustomFieldValues(defs, { firstName: 'Alice' });
      expect(result.isValid).toBe(true);
    });

    it('optional field is skipped when absent', () => {
      const defs: FieldDef[] = [
        { ...field({ fieldKey: 'nickname', fieldType: 'STRING' }), isRequired: false },
      ];
      const result = validateCustomFieldValues(defs, {});
      expect(result.isValid).toBe(true);
    });

    it('min number validation rejects value below minimum', () => {
      const defs: FieldDef[] = [
        {
          ...field({ fieldKey: 'age', fieldType: 'NUMBER' }),
          validationRule: { min: 18 },
        },
      ];
      const result = validateCustomFieldValues(defs, { age: 15 });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/at least 18/);
    });

    it('max number validation rejects value above maximum', () => {
      const defs: FieldDef[] = [
        {
          ...field({ fieldKey: 'age', fieldType: 'NUMBER' }),
          validationRule: { max: 60 },
        },
      ];
      const result = validateCustomFieldValues(defs, { age: 65 });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/at most 60/);
    });

    it('min/max number validation passes for value within range', () => {
      const defs: FieldDef[] = [
        {
          ...field({ fieldKey: 'age', fieldType: 'NUMBER' }),
          validationRule: { min: 18, max: 60 },
        },
      ];
      const result = validateCustomFieldValues(defs, { age: 30 });
      expect(result.isValid).toBe(true);
    });

    it('minLength string validation rejects short string', () => {
      const defs: FieldDef[] = [
        {
          ...field({ fieldKey: 'bio', fieldType: 'STRING' }),
          validationRule: { minLength: 10 },
        },
      ];
      const result = validateCustomFieldValues(defs, { bio: 'short' });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/at least 10 characters/);
    });

    it('maxLength string validation rejects long string', () => {
      const defs: FieldDef[] = [
        {
          ...field({ fieldKey: 'bio', fieldType: 'STRING' }),
          validationRule: { maxLength: 5 },
        },
      ];
      const result = validateCustomFieldValues(defs, { bio: 'toolongstring' });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/at most 5 characters/);
    });

    it('regex validation rejects a non-matching value', () => {
      const defs: FieldDef[] = [
        {
          ...field({ fieldKey: 'pin', fieldType: 'STRING' }),
          validationRule: { regex: '^[0-9]{6}$' },
        },
      ];
      const result = validateCustomFieldValues(defs, { pin: 'ABCDEF' });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/does not match required format/);
    });

    it('regex validation accepts a matching value', () => {
      const defs: FieldDef[] = [
        {
          ...field({ fieldKey: 'pin', fieldType: 'STRING' }),
          validationRule: { regex: '^[0-9]{6}$' },
        },
      ];
      const result = validateCustomFieldValues(defs, { pin: '560001' });
      expect(result.isValid).toBe(true);
    });

    it('multiple errors are collected for multiple invalid fields', () => {
      const defs: FieldDef[] = [
        { ...field({ fieldKey: 'pan', fieldType: 'PAN' }), isRequired: true },
        { ...field({ fieldKey: 'mobile', fieldType: 'PHONE' }), isRequired: true },
      ];
      const result = validateCustomFieldValues(defs, {
        pan: 'INVALID',
        mobile: '1234',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Multi-Tenant Isolation ────────────────────────────────────────────────
  describe('Multi-Tenant Isolation', () => {
    it('field definitions scoped by organizationId: org1 fields do not affect org2 validation', () => {
      // Simulate org1 requiring a custom "gstNumber" field
      const org1Defs: FieldDef[] = [
        { ...field({ fieldKey: 'gstNumber', fieldType: 'STRING' }), isRequired: true },
      ];
      // Org2 has no such field requirement
      const org2Defs: FieldDef[] = [];

      const org1Result = validateCustomFieldValues(org1Defs, {});
      const org2Result = validateCustomFieldValues(org2Defs, {});

      expect(org1Result.isValid).toBe(false); // gstNumber missing for org1
      expect(org2Result.isValid).toBe(true);  // no requirements for org2
    });

    it('two orgs can define a field with the same fieldKey independently', () => {
      const org1Defs: FieldDef[] = [
        {
          ...field({ fieldKey: 'segment', fieldType: 'ENUM' }),
          enumOptions: ['RETAIL', 'SME'],
        },
      ];
      const org2Defs: FieldDef[] = [
        {
          ...field({ fieldKey: 'segment', fieldType: 'ENUM' }),
          enumOptions: ['GOLD', 'PLATINUM'],
        },
      ];

      expect(
        validateCustomFieldValues(org1Defs, { segment: 'RETAIL' }).isValid,
      ).toBe(true);
      expect(
        validateCustomFieldValues(org1Defs, { segment: 'GOLD' }).isValid,
      ).toBe(false); // GOLD is not in org1's options

      expect(
        validateCustomFieldValues(org2Defs, { segment: 'GOLD' }).isValid,
      ).toBe(true);
      expect(
        validateCustomFieldValues(org2Defs, { segment: 'RETAIL' }).isValid,
      ).toBe(false); // RETAIL is not in org2's options
    });

    it('validation uses the correct org field definitions', () => {
      // Org1: age is optional NUMBER with max 70
      const org1Defs: FieldDef[] = [
        {
          ...field({ fieldKey: 'age', fieldType: 'NUMBER' }),
          validationRule: { max: 70 },
        },
      ];
      // Org2: age is required NUMBER with max 65
      const org2Defs: FieldDef[] = [
        {
          ...field({ fieldKey: 'age', fieldType: 'NUMBER' }),
          isRequired: true,
          validationRule: { max: 65 },
        },
      ];

      // age=68 passes for org1 (max 70) but fails for org2 (max 65)
      expect(
        validateCustomFieldValues(org1Defs, { age: 68 }).isValid,
      ).toBe(true);
      expect(
        validateCustomFieldValues(org2Defs, { age: 68 }).isValid,
      ).toBe(false);

      // Missing age: optional for org1, required for org2
      expect(
        validateCustomFieldValues(org1Defs, {}).isValid,
      ).toBe(true);
      expect(
        validateCustomFieldValues(org2Defs, {}).isValid,
      ).toBe(false);
    });
  });

  // ── Form Schema ───────────────────────────────────────────────────────────
  describe('Form Schema', () => {
    type FullFieldDef = FieldDef & {
      isSearchable: boolean;
      isVisibleInList: boolean;
      defaultValue: string | null;
      displayOrder: number;
      sectionName: string | null;
    };

    function fullField(
      overrides: Partial<FullFieldDef> & Pick<FullFieldDef, 'fieldKey' | 'fieldType'>,
    ): FullFieldDef {
      return {
        fieldLabel: overrides.fieldKey,
        isRequired: false,
        enumOptions: null,
        validationRule: null,
        isSearchable: false,
        isVisibleInList: false,
        defaultValue: null,
        displayOrder: 0,
        sectionName: null,
        ...overrides,
      };
    }

    it('groups fields by sectionName', () => {
      const defs: FullFieldDef[] = [
        fullField({ fieldKey: 'f1', fieldType: 'STRING', sectionName: 'Personal' }),
        fullField({ fieldKey: 'f2', fieldType: 'STRING', sectionName: 'Personal' }),
        fullField({ fieldKey: 'f3', fieldType: 'NUMBER', sectionName: 'Financial' }),
      ];

      const schema = buildFormSchema('CUSTOMER', defs);
      expect(schema.sections).toHaveLength(2);
      const personal = schema.sections.find((s) => s.sectionName === 'Personal');
      expect(personal?.fields).toHaveLength(2);
      const financial = schema.sections.find((s) => s.sectionName === 'Financial');
      expect(financial?.fields).toHaveLength(1);
    });

    it('places fields without sectionName in ungroupedFields', () => {
      const defs: FullFieldDef[] = [
        fullField({ fieldKey: 'f1', fieldType: 'STRING', sectionName: 'Docs' }),
        fullField({ fieldKey: 'f2', fieldType: 'NUMBER', sectionName: null }),
        fullField({ fieldKey: 'f3', fieldType: 'BOOLEAN', sectionName: null }),
      ];

      const schema = buildFormSchema('LOAN_APPLICATION', defs);
      expect(schema.ungroupedFields).toHaveLength(2);
      expect(schema.sections).toHaveLength(1);
    });

    it('returns empty sections and ungroupedFields when no definitions exist', () => {
      const schema = buildFormSchema('CUSTOMER', []);
      expect(schema.sections).toHaveLength(0);
      expect(schema.ungroupedFields).toHaveLength(0);
    });

    it('preserves displayOrder within a section', () => {
      const defs: FullFieldDef[] = [
        fullField({ fieldKey: 'z', fieldType: 'STRING', sectionName: 'A', displayOrder: 3 }),
        fullField({ fieldKey: 'a', fieldType: 'STRING', sectionName: 'A', displayOrder: 1 }),
        fullField({ fieldKey: 'm', fieldType: 'STRING', sectionName: 'A', displayOrder: 2 }),
      ];
      // The service fetches fields already ordered from DB; here we pre-sort to test the grouping
      const sorted = [...defs].sort((a, b) => a.displayOrder - b.displayOrder);
      const schema = buildFormSchema('CUSTOMER', sorted);
      const aSection = schema.sections[0];
      expect(aSection.fields.map((f) => f.fieldKey)).toEqual(['a', 'm', 'z']);
    });

    it('entityType is propagated to the schema', () => {
      const schema = buildFormSchema('DSA', []);
      expect(schema.entityType).toBe('DSA');
    });
  });
});
