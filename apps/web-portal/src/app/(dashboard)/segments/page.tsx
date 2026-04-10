"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  Users,
  Layers,
  Tag,
  ChevronRight,
  X,
  Play,
  CheckCircle,
  XCircle,
  Trash2,
  Edit2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Types ────────────────────────────────────────────────────────────────────

interface SegmentRule {
  field: string;
  operator: string;
  value?: unknown;
  value2?: unknown;
}

interface Segment {
  id: string;
  segmentCode: string;
  segmentName: string;
  description?: string | null;
  segmentType: string;
  priority: number;
  isActive: boolean;
  isAutoAssign: boolean;
  rules: SegmentRule[];
  mappedSchemeIds?: string[] | null;
  offerPriority: string;
  maxOffersToShow: number;
  memberCount: number;
  createdAt: string;
}

interface SegmentDetail extends Segment {
  members: Array<{
    id: string;
    assignedAt: string;
    score: number | null;
    customer: {
      id: string;
      customerNumber: string;
      fullName: string;
      phone: string;
      employmentType: string;
      kycStatus: string;
    };
  }>;
  mappedSchemes: Array<{
    id: string;
    schemeCode: string;
    schemeName: string;
    schemeType: string;
    isActive: boolean;
  }>;
}

interface ReportRow {
  segmentId: string;
  segmentCode: string;
  segmentName: string;
  segmentType: string;
  priority: number;
  isActive: boolean;
  memberCount: number;
  loanCount: number;
  conversionRate: string;
  totalDisbursedRupees: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_TYPES = [
  "DEMOGRAPHIC",
  "BEHAVIORAL",
  "RISK",
  "INCOME",
  "PRODUCT_AFFINITY",
  "GEOGRAPHIC",
  "LOYALTY",
  "CUSTOM",
];

const FIELD_OPTIONS = [
  "customer.age",
  "customer.gender",
  "customer.employmentType",
  "customer.customerType",
  "customer.monthlyIncomePaisa",
  "customer.city",
  "customer.state",
  "customer.pincode",
  "customer.kycStatus",
  "customer.riskCategory",
  "bureau.score",
  "bureau.totalActiveLoans",
  "bureau.maxDpdLast12Months",
  "bureau.hasWriteOff",
  "bureau.enquiriesLast3Months",
  "loan.existingLoanCount",
  "loan.totalOutstandingPaisa",
  "loan.maxDpd",
];

const OPERATORS = [
  { value: "EQ", label: "Equals" },
  { value: "NEQ", label: "Not Equals" },
  { value: "GT", label: "Greater Than" },
  { value: "GTE", label: "Greater Than or Equal" },
  { value: "LT", label: "Less Than" },
  { value: "LTE", label: "Less Than or Equal" },
  { value: "IN", label: "In List" },
  { value: "NOT_IN", label: "Not In List" },
  { value: "BETWEEN", label: "Between" },
  { value: "CONTAINS", label: "Contains" },
  { value: "STARTS_WITH", label: "Starts With" },
  { value: "IS_NULL", label: "Is Empty" },
  { value: "IS_NOT_NULL", label: "Is Not Empty" },
];

const OFFER_PRIORITIES = [
  { value: "BEST_RATE", label: "Best Rate (lowest interest)" },
  { value: "LOWEST_FEE", label: "Lowest Fee" },
  { value: "HIGHEST_CASHBACK", label: "Highest Cashback" },
  { value: "MANUAL", label: "Manual Order" },
];

const SEGMENT_TYPE_COLORS: Record<string, string> = {
  DEMOGRAPHIC: "bg-blue-100 text-blue-800",
  BEHAVIORAL: "bg-purple-100 text-purple-800",
  RISK: "bg-red-100 text-red-800",
  INCOME: "bg-green-100 text-green-800",
  PRODUCT_AFFINITY: "bg-indigo-100 text-indigo-800",
  GEOGRAPHIC: "bg-yellow-100 text-yellow-800",
  LOYALTY: "bg-orange-100 text-orange-800",
  CUSTOM: "bg-gray-100 text-gray-800",
};

// ── API Helpers ───────────────────────────────────────────────────────────────

function getAuthHeaders() {
  const token = localStorage.getItem("bankos_token") ?? "";
  const userStr = localStorage.getItem("bankos_user") ?? "{}";
  let orgId = "";
  try {
    orgId = JSON.parse(userStr)?.organizationId ?? "";
  } catch {}
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-org-id": orgId,
    "x-user-id": "system",
  };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Create Segment Modal ──────────────────────────────────────────────────────

function CreateSegmentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    segmentCode: "",
    segmentName: "",
    description: "",
    segmentType: "DEMOGRAPHIC",
    priority: 50,
    isAutoAssign: true,
    offerPriority: "BEST_RATE",
    maxOffersToShow: 3,
  });
  const [rules, setRules] = useState<SegmentRule[]>([
    { field: "customer.age", operator: "GTE", value: "" },
  ]);
  const [schemeIds, setSchemeIds] = useState("");

  const addRule = () =>
    setRules((r) => [...r, { field: "customer.age", operator: "EQ", value: "" }]);

  const removeRule = (i: number) =>
    setRules((r) => r.filter((_, idx) => idx !== i));

  const updateRule = (i: number, key: keyof SegmentRule, val: unknown) =>
    setRules((r) => r.map((rule, idx) => (idx === i ? { ...rule, [key]: val } : rule)));

  const parseRuleValue = (operator: string, rawValue: string): unknown => {
    if (operator === "IS_NULL" || operator === "IS_NOT_NULL") return undefined;
    if (operator === "IN" || operator === "NOT_IN") {
      return rawValue
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    }
    const num = Number(rawValue);
    if (!isNaN(num) && rawValue.trim() !== "") return num;
    if (rawValue === "true") return true;
    if (rawValue === "false") return false;
    return rawValue;
  };

  const handleSave = async () => {
    if (!form.segmentCode || !form.segmentName || rules.length === 0) {
      setError("Code, name, and at least one rule are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const parsedRules = rules.map((r) => ({
        field: r.field,
        operator: r.operator,
        value: parseRuleValue(r.operator, String(r.value ?? "")),
        ...(r.operator === "BETWEEN" && r.value2 !== undefined
          ? { value2: parseRuleValue("GTE", String(r.value2)) }
          : {}),
      }));

      const mappedSchemeIds = schemeIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch(`${API}/api/v1/segmentation/segments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...form,
          rules: parsedRules,
          mappedSchemeIds: mappedSchemeIds.length > 0 ? mappedSchemeIds : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed to create segment");
      }

      onCreated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Create Customer Segment">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Segment Code *
            </label>
            <Input
              value={form.segmentCode}
              onChange={(e) => setForm((f) => ({ ...f, segmentCode: e.target.value.toUpperCase() }))}
              placeholder="PREMIUM-SALARIED"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Segment Name *
            </label>
            <Input
              value={form.segmentName}
              onChange={(e) => setForm((f) => ({ ...f, segmentName: e.target.value }))}
              placeholder="Premium Salaried"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Type
            </label>
            <select
              className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.segmentType}
              onChange={(e) => setForm((f) => ({ ...f, segmentType: e.target.value }))}
            >
              {SEGMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Priority
            </label>
            <Input
              type="number"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Max Offers
            </label>
            <Input
              type="number"
              value={form.maxOffersToShow}
              onChange={(e) => setForm((f) => ({ ...f, maxOffersToShow: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Description
          </label>
          <textarea
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Describe this segment..."
          />
        </div>

        {/* Offer Priority */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Offer Sort Priority
          </label>
          <select
            className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.offerPriority}
            onChange={(e) => setForm((f) => ({ ...f, offerPriority: e.target.value }))}
          >
            {OFFER_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Rules Builder */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700">
              Eligibility Rules (ALL must match)
            </label>
            <button
              type="button"
              onClick={addRule}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Rule
            </button>
          </div>
          <div className="space-y-2">
            {rules.map((rule, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
              >
                {/* Field */}
                <select
                  className="flex-1 text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={rule.field}
                  onChange={(e) => updateRule(i, "field", e.target.value)}
                >
                  {FIELD_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>

                {/* Operator */}
                <select
                  className="text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={rule.operator}
                  onChange={(e) => updateRule(i, "operator", e.target.value)}
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Value */}
                {rule.operator !== "IS_NULL" && rule.operator !== "IS_NOT_NULL" && (
                  <Input
                    className="flex-1 text-xs py-1"
                    value={String(rule.value ?? "")}
                    onChange={(e) => updateRule(i, "value", e.target.value)}
                    placeholder={
                      rule.operator === "IN" || rule.operator === "NOT_IN"
                        ? "val1, val2"
                        : "value"
                    }
                  />
                )}

                {/* Value2 for BETWEEN */}
                {rule.operator === "BETWEEN" && (
                  <>
                    <span className="text-xs text-gray-500">and</span>
                    <Input
                      className="flex-1 text-xs py-1"
                      value={String(rule.value2 ?? "")}
                      onChange={(e) => updateRule(i, "value2", e.target.value)}
                      placeholder="max"
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => removeRule(i)}
                  className="text-gray-400 hover:text-red-500 flex-shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Scheme Mapping */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Mapped Scheme IDs (comma-separated, optional)
          </label>
          <Input
            value={schemeIds}
            onChange={(e) => setSchemeIds(e.target.value)}
            placeholder="scheme-uuid-1, scheme-uuid-2"
          />
          <p className="text-xs text-gray-400 mt-1">
            Leave blank to map all active schemes. Use scheme IDs from the Schemes page.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="isAutoAssign"
            checked={form.isAutoAssign}
            onChange={(e) => setForm((f) => ({ ...f, isAutoAssign: e.target.checked }))}
          />
          <label htmlFor="isAutoAssign" className="text-sm text-gray-700">
            Auto-assign during loan application
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Creating..." : "Create Segment"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Segment Detail Modal ──────────────────────────────────────────────────────

function SegmentDetailModal({
  segment,
  onClose,
}: {
  segment: SegmentDetail | null;
  onClose: () => void;
}) {
  if (!segment) return null;

  return (
    <Modal open={!!segment} onClose={onClose} title={segment.segmentName}>
      <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
        {/* Header info */}
        <div className="flex flex-wrap gap-2">
          <Badge className={SEGMENT_TYPE_COLORS[segment.segmentType] ?? "bg-gray-100"}>
            {segment.segmentType}
          </Badge>
          <Badge className="bg-blue-50 text-blue-700">Priority {segment.priority}</Badge>
          <Badge className={segment.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
            {segment.isActive ? "Active" : "Inactive"}
          </Badge>
          <Badge className="bg-purple-50 text-purple-700">
            {segment.memberCount} members
          </Badge>
        </div>

        {segment.description && (
          <p className="text-sm text-gray-600">{segment.description}</p>
        )}

        {/* Rules */}
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Eligibility Rules (AND logic)
          </h3>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segment.rules.map((rule, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{rule.field}</TableCell>
                    <TableCell className="text-xs">
                      <Badge className="bg-gray-100 text-gray-700 text-xs">
                        {OPERATORS.find((o) => o.value === rule.operator)?.label ?? rule.operator}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {rule.operator === "IS_NULL" || rule.operator === "IS_NOT_NULL"
                        ? "—"
                        : rule.operator === "BETWEEN"
                        ? `${rule.value} — ${rule.value2}`
                        : Array.isArray(rule.value)
                        ? rule.value.join(", ")
                        : String(rule.value ?? "")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Mapped Schemes */}
        {segment.mappedSchemes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Mapped Schemes</h3>
            <div className="flex flex-wrap gap-2">
              {segment.mappedSchemes.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-800"
                >
                  <Tag className="h-3 w-3" />
                  {s.schemeName}
                  {!s.isActive && (
                    <span className="text-red-400 ml-1">(inactive)</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Recent Members (latest 20)
          </h3>
          {segment.members.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No members yet. Run segmentation to assign customers.</p>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Employment</TableHead>
                    <TableHead>KYC</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segment.members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="text-sm font-medium text-gray-900">
                          {m.customer.fullName}
                        </div>
                        <div className="text-xs text-gray-500">{m.customer.customerNumber}</div>
                      </TableCell>
                      <TableCell className="text-xs">{m.customer.employmentType}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            m.customer.kycStatus === "VERIFIED"
                              ? "bg-green-100 text-green-700 text-xs"
                              : "bg-yellow-100 text-yellow-700 text-xs"
                          }
                        >
                          {m.customer.kycStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {m.score !== null ? `${Number(m.score).toFixed(0)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {new Date(m.assignedAt).toLocaleDateString("en-IN")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Offer Config */}
        <div className="flex gap-4 text-sm p-3 bg-gray-50 rounded-lg">
          <span>
            <span className="text-gray-500">Offer Sort: </span>
            <span className="font-medium">
              {OFFER_PRIORITIES.find((p) => p.value === segment.offerPriority)?.label ?? segment.offerPriority}
            </span>
          </span>
          <span>
            <span className="text-gray-500">Max Offers: </span>
            <span className="font-medium">{segment.maxOffersToShow}</span>
          </span>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<SegmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"grid" | "report">("grid");

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeFilter) params.set("segmentType", typeFilter);
      const res = await fetch(
        `${API}/api/v1/segmentation/segments?${params.toString()}`,
        { headers: getAuthHeaders() },
      );
      if (!res.ok) throw new Error("Failed to fetch segments");
      const data = await res.json();
      setSegments(data.data ?? []);
    } catch {
      setSegments([]);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/segmentation/report`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch report");
      const data = await res.json();
      setReport(data.segments ?? []);
    } catch {
      setReport([]);
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  useEffect(() => {
    if (activeTab === "report") fetchReport();
  }, [activeTab, fetchReport]);

  const openDetail = async (seg: Segment) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/segmentation/segments/${seg.id}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch detail");
      const data = await res.json();
      setSelectedSegment(data);
    } catch {
      setSelectedSegment(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const runBulkSegmentation = async () => {
    setBulkRunning(true);
    setBulkResult(null);
    try {
      const res = await fetch(`${API}/api/v1/segmentation/bulk-evaluate`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setBulkResult(
        `Done: ${data.processed} customers processed, ${data.totalNewAssignments} segment assignments, ${data.errors} errors.`,
      );
      await fetchSegments();
    } catch {
      setBulkResult("Bulk segmentation failed.");
    } finally {
      setBulkRunning(false);
    }
  };

  const deactivateSegment = async (segId: string) => {
    if (!confirm("Deactivate this segment?")) return;
    await fetch(`${API}/api/v1/segmentation/segments/${segId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    fetchSegments();
  };

  const filtered = segments.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.segmentName.toLowerCase().includes(q) ||
      s.segmentCode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Segments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Auto-classify customers into segments based on rules. Matched segments
            surface eligible schemes during loan origination.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={runBulkSegmentation}
            disabled={bulkRunning}
            className="gap-1.5"
          >
            <Play className="h-4 w-4" />
            {bulkRunning ? "Running..." : "Run Segmentation"}
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Segment
          </Button>
        </div>
      </div>

      {/* Bulk result banner */}
      {bulkResult && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm text-blue-800">{bulkResult}</span>
          <button onClick={() => setBulkResult(null)}>
            <X className="h-4 w-4 text-blue-400" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        <button
          onClick={() => setActiveTab("grid")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "grid"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Segments
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "report"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Conversion Report
        </button>
      </div>

      {activeTab === "grid" && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search segments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {SEGMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={fetchSegments}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
              Loading segments...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Layers className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">No segments found. Create your first segment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((seg) => (
                <Card
                  key={seg.id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-gray-200"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {seg.segmentName}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                          {seg.segmentCode}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {seg.isActive ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deactivateSegment(seg.id);
                          }}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                          title="Deactivate"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge
                          className={`text-xs ${
                            SEGMENT_TYPE_COLORS[seg.segmentType] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {seg.segmentType}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          Priority {seg.priority}
                        </span>
                      </div>

                      {seg.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {seg.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 pt-1 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-blue-500" />
                          <span className="font-medium">{seg.memberCount}</span> members
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag className="h-3.5 w-3.5 text-purple-500" />
                          <span>{seg.rules.length} rules</span>
                        </span>
                      </div>

                      <button
                        onClick={() => openDetail(seg)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
                      >
                        View details
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "report" && (
        <div>
          {reportLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
              Loading report...
            </div>
          ) : !report ? null : (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Segment</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-right">Members</TableHead>
                    <TableHead className="text-right">Loans</TableHead>
                    <TableHead className="text-right">Conversion</TableHead>
                    <TableHead className="text-right">Disbursed (₹)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.map((row) => (
                    <TableRow key={row.segmentId}>
                      <TableCell>
                        <div className="text-sm font-medium text-gray-900">
                          {row.segmentName}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {row.segmentCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${
                            SEGMENT_TYPE_COLORS[row.segmentType] ?? "bg-gray-100"
                          }`}
                        >
                          {row.segmentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{row.priority}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {row.memberCount.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.loanCount.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`text-sm font-semibold ${
                            parseFloat(row.conversionRate) > 30
                              ? "text-green-600"
                              : parseFloat(row.conversionRate) > 10
                              ? "text-yellow-600"
                              : "text-gray-600"
                          }`}
                        >
                          {row.conversionRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        ₹{Number(row.totalDisbursedRupees).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            row.isActive
                              ? "bg-green-100 text-green-700 text-xs"
                              : "bg-gray-100 text-gray-500 text-xs"
                          }
                        >
                          {row.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateSegmentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchSegments();
        }}
      />

      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 text-sm text-gray-700">
            Loading segment detail...
          </div>
        </div>
      )}

      <SegmentDetailModal
        segment={selectedSegment}
        onClose={() => setSelectedSegment(null)}
      />
    </div>
  );
}
