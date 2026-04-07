"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { customFieldsApi, type FieldDefinition, type FormSchema } from "@/lib/api";

export interface DynamicFormRendererProps {
  entityType: string;
  initialValues?: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  readOnly?: boolean;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function FieldInput({
  field,
  value,
  onChange,
  error,
  readOnly,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: string;
  readOnly?: boolean;
}) {
  const baseInputClass =
    "flex h-9 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

  const errorClass = error ? "border-red-400 focus-visible:ring-red-400" : "border-gray-300";

  const commonProps = {
    disabled: readOnly,
    readOnly: readOnly,
  };

  const stringVal = value !== undefined && value !== null ? String(value) : "";

  const { fieldType, fieldLabel, isRequired, validationRule, enumOptions } = field;

  switch (fieldType) {
    case "BOOLEAN":
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`field-${field.fieldKey}`}
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={readOnly}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor={`field-${field.fieldKey}`} className="text-sm text-gray-700">
            {fieldLabel}
            {isRequired && <span className="text-red-500 ml-1">*</span>}
          </label>
        </div>
      );

    case "ENUM":
      return (
        <Select
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          {...commonProps}
          className={errorClass}
        >
          <option value="">Select {fieldLabel}</option>
          {(enumOptions ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      );

    case "TEXTAREA":
      return (
        <textarea
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          readOnly={readOnly}
          rows={3}
          minLength={validationRule?.minLength}
          maxLength={validationRule?.maxLength}
          className={`${baseInputClass} ${errorClass} h-auto resize-y`}
        />
      );

    case "CURRENCY":
      return (
        <div className="relative">
          <span className="absolute left-3 top-2 text-sm text-gray-500 pointer-events-none select-none">
            ₹
          </span>
          <Input
            type="number"
            value={stringVal}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            min={validationRule?.min}
            max={validationRule?.max}
            step="0.01"
            className={`pl-7 ${errorClass}`}
            {...commonProps}
          />
        </div>
      );

    case "PERCENTAGE":
      return (
        <div className="relative">
          <Input
            type="number"
            value={stringVal}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            min={validationRule?.min ?? 0}
            max={validationRule?.max ?? 100}
            step="0.01"
            className={`pr-8 ${errorClass}`}
            {...commonProps}
          />
          <span className="absolute right-3 top-2 text-sm text-gray-500 pointer-events-none select-none">
            %
          </span>
        </div>
      );

    case "NUMBER":
      return (
        <Input
          type="number"
          value={stringVal}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          min={validationRule?.min}
          max={validationRule?.max}
          className={errorClass}
          {...commonProps}
        />
      );

    case "DATE":
      return (
        <Input
          type="date"
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          className={errorClass}
          {...commonProps}
        />
      );

    case "PHONE":
      return (
        <Input
          type="tel"
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          pattern={validationRule?.regex ?? "[0-9]{10}"}
          placeholder="10-digit mobile number"
          className={errorClass}
          {...commonProps}
        />
      );

    case "EMAIL":
      return (
        <Input
          type="email"
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          className={errorClass}
          {...commonProps}
        />
      );

    case "PAN":
      return (
        <Input
          type="text"
          value={stringVal}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          pattern={validationRule?.regex ?? "[A-Z]{5}[0-9]{4}[A-Z]{1}"}
          placeholder="ABCDE1234F"
          maxLength={10}
          className={`font-mono uppercase ${errorClass}`}
          {...commonProps}
        />
      );

    case "AADHAAR":
      return (
        <Input
          type="text"
          value={stringVal}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 12))}
          pattern={validationRule?.regex ?? "[0-9]{12}"}
          placeholder="12-digit Aadhaar number"
          maxLength={12}
          inputMode="numeric"
          className={`font-mono ${errorClass}`}
          {...commonProps}
        />
      );

    case "STRING":
    default:
      return (
        <Input
          type="text"
          value={stringVal}
          onChange={(e) => onChange(e.target.value)}
          minLength={validationRule?.minLength}
          maxLength={validationRule?.maxLength}
          pattern={validationRule?.regex}
          className={errorClass}
          {...commonProps}
        />
      );
  }
}

function FieldWrapper({
  field,
  value,
  onChange,
  error,
  readOnly,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: string;
  readOnly?: boolean;
}) {
  const isBooleanType = field.fieldType === "BOOLEAN";

  return (
    <div className="space-y-1.5">
      {!isBooleanType && (
        <label className="block text-sm font-medium text-gray-700">
          {field.fieldLabel}
          {field.isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <FieldInput
        field={field}
        value={value}
        onChange={onChange}
        error={error}
        readOnly={readOnly}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function DynamicFormRenderer({
  entityType,
  initialValues,
  onChange,
  errors,
  readOnly,
}: DynamicFormRendererProps) {
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>(initialValues ?? {});

  useEffect(() => {
    setValues(initialValues ?? {});
  }, [initialValues]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    customFieldsApi
      .getFormSchema(entityType)
      .then((data) => {
        if (!cancelled) setSchema(data);
      })
      .catch((err) => {
        if (!cancelled)
          setFetchError(err?.message ?? "Failed to load custom fields");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityType]);

  const handleFieldChange = useCallback(
    (fieldKey: string, val: unknown) => {
      setValues((prev) => {
        const next = { ...prev, [fieldKey]: val };
        onChange(next);
        return next;
      });
    },
    [onChange]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-500">Loading custom fields...</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Could not load custom fields: {fetchError}
      </div>
    );
  }

  if (!schema) return null;

  const hasContent =
    schema.sections.length > 0 || schema.ungrouped.length > 0;

  if (!hasContent) return null;

  return (
    <div className="space-y-6">
      {/* Grouped sections */}
      {schema.sections.map((section) => (
        <div key={section.name} className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-2">
            {section.name}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {section.fields.map((field) => (
              <FieldWrapper
                key={field.fieldKey}
                field={field}
                value={values[field.fieldKey]}
                onChange={(val) => handleFieldChange(field.fieldKey, val)}
                error={errors?.[field.fieldKey]}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Ungrouped fields */}
      {schema.ungrouped.length > 0 && (
        <div className="space-y-4">
          {schema.sections.length > 0 && (
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-2">
              Additional Fields
            </h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {schema.ungrouped.map((field) => (
              <FieldWrapper
                key={field.fieldKey}
                field={field}
                value={values[field.fieldKey]}
                onChange={(val) => handleFieldChange(field.fieldKey, val)}
                error={errors?.[field.fieldKey]}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export slugify utility for use in admin page
export { slugify };
