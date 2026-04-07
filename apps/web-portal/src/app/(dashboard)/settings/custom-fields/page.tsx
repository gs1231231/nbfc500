"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, PowerOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { customFieldsApi, type FieldDefinition } from "@/lib/api";
import { slugify } from "@/components/dynamic-form/DynamicFormRenderer";

const ENTITY_TYPES = [
  "CUSTOMER",
  "LOAN_APPLICATION",
  "LOAN",
  "COLLECTION_TASK",
  "BRANCH",
  "PRODUCT",
];

const FIELD_TYPES = [
  { value: "STRING", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "BOOLEAN", label: "Yes / No" },
  { value: "ENUM", label: "Dropdown (Enum)" },
  { value: "PHONE", label: "Phone" },
  { value: "EMAIL", label: "Email" },
  { value: "PAN", label: "PAN" },
  { value: "AADHAAR", label: "Aadhaar" },
  { value: "TEXTAREA", label: "Text Area" },
  { value: "CURRENCY", label: "Currency (₹)" },
  { value: "PERCENTAGE", label: "Percentage (%)" },
];

const EMPTY_FORM: Omit<FieldDefinition, "id" | "isActive"> = {
  entityType: "CUSTOMER",
  fieldKey: "",
  fieldLabel: "",
  fieldType: "STRING",
  isRequired: false,
  isSearchable: false,
  isVisibleInList: false,
  enumOptions: [],
  defaultValue: "",
  validationRule: {},
  displayOrder: 0,
  sectionName: "",
};

function labelToKey(label: string): string {
  return slugify(label);
}

export default function CustomFieldsPage() {
  const [entityType, setEntityType] = useState("CUSTOMER");
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [formData, setFormData] = useState<Omit<FieldDefinition, "id" | "isActive">>(EMPTY_FORM);
  const [enumText, setEnumText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [labelTouched, setLabelTouched] = useState(false);

  const loadFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await customFieldsApi.list(entityType);
      setFields(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Failed to load fields");
      setFields([]);
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  function openAddModal() {
    setEditingField(null);
    setFormData({ ...EMPTY_FORM, entityType });
    setEnumText("");
    setSaveError(null);
    setLabelTouched(false);
    setModalOpen(true);
  }

  function openEditModal(field: FieldDefinition) {
    setEditingField(field);
    setFormData({
      entityType: field.entityType,
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      isSearchable: field.isSearchable,
      isVisibleInList: field.isVisibleInList,
      enumOptions: field.enumOptions ?? [],
      defaultValue: field.defaultValue ?? "",
      validationRule: field.validationRule ?? {},
      displayOrder: field.displayOrder,
      sectionName: field.sectionName ?? "",
    });
    setEnumText((field.enumOptions ?? []).join("\n"));
    setSaveError(null);
    setLabelTouched(true);
    setModalOpen(true);
  }

  function handleLabelChange(label: string) {
    setFormData((prev) => ({
      ...prev,
      fieldLabel: label,
      fieldKey: labelTouched && prev.fieldKey !== labelToKey(prev.fieldLabel)
        ? prev.fieldKey
        : labelToKey(label),
    }));
  }

  async function handleDeactivate(field: FieldDefinition) {
    if (!confirm(`Deactivate field "${field.fieldLabel}"?`)) return;
    try {
      await customFieldsApi.deactivate(field.id);
      await loadFields();
    } catch (err: unknown) {
      alert((err as Error)?.message ?? "Failed to deactivate field");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    const payload: Partial<FieldDefinition> = {
      ...formData,
      enumOptions:
        formData.fieldType === "ENUM"
          ? enumText
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
    };

    try {
      if (editingField) {
        await customFieldsApi.update(editingField.id, payload);
      } else {
        await customFieldsApi.create(payload);
      }
      setModalOpen(false);
      await loadFields();
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? "Failed to save field");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Fields</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define additional fields that auto-appear in forms without code changes.
          </p>
        </div>
        <Button onClick={openAddModal} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Field
        </Button>
      </div>

      {/* Entity type selector */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Entity Type
          </label>
          <div className="w-64">
            <Select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              {ENTITY_TYPES.map((et) => (
                <option key={et} value={et}>
                  {et.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>
          <span className="text-sm text-gray-500">
            {fields.length} field{fields.length !== 1 ? "s" : ""} defined
          </span>
        </CardContent>
      </Card>

      {/* Fields table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Fields for {entityType.replace(/_/g, " ")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
              <span className="text-sm text-gray-500">Loading fields...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-red-600">{error}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-center">Required</TableHead>
                  <TableHead className="text-center">Searchable</TableHead>
                  <TableHead className="text-center">In List</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-gray-400 py-12"
                    >
                      No custom fields defined for this entity type.
                      <br />
                      <span className="text-xs">
                        Click "Add Field" to create one.
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  fields.map((field) => (
                    <TableRow key={field.id}>
                      <TableCell className="font-mono text-xs text-gray-600">
                        {field.fieldKey}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {field.fieldLabel}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {FIELD_TYPES.find((t) => t.value === field.fieldType)
                            ?.label ?? field.fieldType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {field.sectionName || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={
                            field.isRequired
                              ? "text-green-600 font-semibold"
                              : "text-gray-300"
                          }
                        >
                          {field.isRequired ? "Yes" : "No"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={
                            field.isSearchable
                              ? "text-green-600 font-semibold"
                              : "text-gray-300"
                          }
                        >
                          {field.isSearchable ? "Yes" : "No"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={
                            field.isVisibleInList
                              ? "text-green-600 font-semibold"
                              : "text-gray-300"
                          }
                        >
                          {field.isVisibleInList ? "Yes" : "No"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={field.isActive ? "success" : "secondary"}
                        >
                          {field.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(field)}
                            title="Edit field"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {field.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeactivate(field)}
                              title="Deactivate field"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <PowerOff className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingField ? "Edit Custom Field" : "Add Custom Field"}
        description="Define a new field that will appear in forms for this entity type."
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: Label + Key */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Field Label <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.fieldLabel}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="e.g. Occupation"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Field Key <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.fieldKey}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    fieldKey: slugify(e.target.value),
                  }))
                }
                onFocus={() => setLabelTouched(true)}
                placeholder="e.g. occupation"
                className="font-mono"
                required
              />
              <p className="text-xs text-gray-400">
                Auto-generated from label. Lowercase, underscores only.
              </p>
            </div>
          </div>

          {/* Row 2: Type + Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Field Type <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.fieldType}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, fieldType: e.target.value }))
                }
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Section Name
              </label>
              <Input
                value={formData.sectionName ?? ""}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, sectionName: e.target.value }))
                }
                placeholder="e.g. Employment Details"
              />
            </div>
          </div>

          {/* Enum options */}
          {formData.fieldType === "ENUM" && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Options <span className="text-red-500">*</span>
              </label>
              <textarea
                value={enumText}
                onChange={(e) => setEnumText(e.target.value)}
                placeholder={"Enter one option per line:\nSalaried\nSelf-Employed\nBusiness Owner"}
                rows={5}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-y"
              />
              <p className="text-xs text-gray-400">One option per line.</p>
            </div>
          )}

          {/* Validation: min / max / regex */}
          {["NUMBER", "CURRENCY", "PERCENTAGE"].includes(formData.fieldType) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Min Value
                </label>
                <Input
                  type="number"
                  value={formData.validationRule?.min ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      validationRule: {
                        ...p.validationRule,
                        min: e.target.value === "" ? undefined : Number(e.target.value),
                      },
                    }))
                  }
                  placeholder="No minimum"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Max Value
                </label>
                <Input
                  type="number"
                  value={formData.validationRule?.max ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      validationRule: {
                        ...p.validationRule,
                        max: e.target.value === "" ? undefined : Number(e.target.value),
                      },
                    }))
                  }
                  placeholder="No maximum"
                />
              </div>
            </div>
          )}

          {["STRING", "TEXTAREA"].includes(formData.fieldType) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Min Length
                </label>
                <Input
                  type="number"
                  value={formData.validationRule?.minLength ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      validationRule: {
                        ...p.validationRule,
                        minLength: e.target.value === "" ? undefined : Number(e.target.value),
                      },
                    }))
                  }
                  placeholder="No minimum"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Max Length
                </label>
                <Input
                  type="number"
                  value={formData.validationRule?.maxLength ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      validationRule: {
                        ...p.validationRule,
                        maxLength: e.target.value === "" ? undefined : Number(e.target.value),
                      },
                    }))
                  }
                  placeholder="No maximum"
                />
              </div>
            </div>
          )}

          {["STRING", "PHONE"].includes(formData.fieldType) && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Regex Validation
              </label>
              <Input
                value={formData.validationRule?.regex ?? ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    validationRule: {
                      ...p.validationRule,
                      regex: e.target.value || undefined,
                    },
                  }))
                }
                placeholder="e.g. ^[A-Z]{2}[0-9]{8}$"
                className="font-mono"
              />
            </div>
          )}

          {/* Default value */}
          {!["BOOLEAN", "ENUM"].includes(formData.fieldType) && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Default Value
              </label>
              <Input
                value={formData.defaultValue ?? ""}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, defaultValue: e.target.value }))
                }
                placeholder="Leave blank for no default"
              />
            </div>
          )}

          {/* Display order */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Display Order
            </label>
            <Input
              type="number"
              value={formData.displayOrder}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  displayOrder: Number(e.target.value),
                }))
              }
              min={0}
              className="w-32"
            />
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-6 pt-1">
            {(
              [
                ["isRequired", "Required"],
                ["isSearchable", "Searchable"],
                ["isVisibleInList", "Visible in List"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={Boolean(formData[key as keyof typeof formData])}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, [key]: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {label}
              </label>
            ))}
          </div>

          {saveError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {saveError}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : editingField ? (
                "Save Changes"
              ) : (
                "Create Field"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
