"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Tag,
  TrendingDown,
  Percent,
  Gift,
  ChevronRight,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Types ───────────────────────────────────────────────────────────────────

interface SchemeBenefits {
  interestRateDiscountBps?: number | null;
  interestRateDiscountPercent?: number | null;
  fixedInterestRateBps?: number | null;
  fixedInterestRatePercent?: number | null;
  processingFeeDiscountPercent?: number | null;
  processingFeeWaiver?: boolean;
  stampDutyWaiver?: boolean;
  cashbackAmountRupees?: number | null;
  cashbackCondition?: string | null;
  insuranceDiscount?: number | null;
  additionalBenefits?: Record<string, unknown> | null;
}

interface SchemeLimits {
  maxDisbursementCount?: number | null;
  currentDisbursementCount: number;
  maxDisbursementAmountRupees?: number | null;
  currentDisbursementAmountRupees: number;
}

interface Scheme {
  id: string;
  schemeCode: string;
  schemeName: string;
  description?: string | null;
  schemeType: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  status: "ACTIVE" | "EXPIRED" | "UPCOMING" | "INACTIVE";
  productId?: string | null;
  product?: { name: string; productType: string } | null;
  benefits: SchemeBenefits;
  limits: SchemeLimits;
  eligibility: Record<string, unknown>;
  approval: { requiresApproval: boolean; approvalAuthority?: string | null };
  applicationCount: number;
  createdAt: string;
}

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_SCHEMES: Scheme[] = [
  {
    id: "s1",
    schemeCode: "DIWALI-2026",
    schemeName: "Diwali Dhamaka 2026",
    description: "Festive season offer — flat 2% rate discount and zero processing fee on personal loans.",
    schemeType: "FESTIVE",
    validFrom: "2026-10-15T00:00:00.000Z",
    validTo: "2026-11-15T23:59:59.000Z",
    isActive: true,
    status: "UPCOMING",
    product: { name: "Personal Loan", productType: "PERSONAL_LOAN" },
    benefits: {
      interestRateDiscountBps: 200,
      interestRateDiscountPercent: 2,
      processingFeeWaiver: true,
    },
    limits: {
      maxDisbursementCount: 100,
      currentDisbursementCount: 0,
      maxDisbursementAmountRupees: 500_00_000,
      currentDisbursementAmountRupees: 0,
    },
    eligibility: {},
    approval: { requiresApproval: false },
    applicationCount: 0,
    createdAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "s2",
    schemeCode: "SAL-SPECIAL-2026",
    schemeName: "Salaried Special",
    description: "Exclusive offer for salaried professionals with CIBIL 700+.",
    schemeType: "PROMOTIONAL",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2026-12-31T23:59:59.000Z",
    isActive: true,
    status: "ACTIVE",
    product: { name: "Personal Loan", productType: "PERSONAL_LOAN" },
    benefits: {
      interestRateDiscountBps: 150,
      interestRateDiscountPercent: 1.5,
      processingFeeDiscountPercent: 50,
    },
    limits: {
      currentDisbursementCount: 18,
      currentDisbursementAmountRupees: 9_00_000,
    },
    eligibility: { minCibilScore: 700, eligibleEmploymentTypes: ["SALARIED"] },
    approval: { requiresApproval: false },
    applicationCount: 22,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "s3",
    schemeCode: "BT-BONANZA-2026",
    schemeName: "BT Bonanza",
    description: "Balance Transfer scheme with 1% rate discount. Max DPD 30 on source loan.",
    schemeType: "BALANCE_TRANSFER",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2026-12-31T23:59:59.000Z",
    isActive: true,
    status: "ACTIVE",
    product: null,
    benefits: { interestRateDiscountBps: 100, interestRateDiscountPercent: 1 },
    limits: { currentDisbursementCount: 5, currentDisbursementAmountRupees: 2_50_000 },
    eligibility: { balanceTransferMaxDays: 30 },
    approval: { requiresApproval: false },
    applicationCount: 7,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "s4",
    schemeCode: "CORP-HDFC-2026",
    schemeName: "Corporate Tie-Up HDFC",
    description: "Exclusive fixed-rate offer for HDFC Bank employees. Zero processing fee.",
    schemeType: "CORPORATE_TIE_UP",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2026-12-31T23:59:59.000Z",
    isActive: true,
    status: "ACTIVE",
    product: { name: "Personal Loan", productType: "PERSONAL_LOAN" },
    benefits: {
      fixedInterestRateBps: 1100,
      fixedInterestRatePercent: 11,
      processingFeeWaiver: true,
    },
    limits: { currentDisbursementCount: 31, currentDisbursementAmountRupees: 15_50_000 },
    eligibility: { eligibleEmploymentTypes: ["SALARIED"] },
    approval: { requiresApproval: false },
    applicationCount: 35,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

// ── Constants ────────────────────────────────────────────────────────────────

const SCHEME_TYPES = [
  "FESTIVE",
  "PROMOTIONAL",
  "BALANCE_TRANSFER",
  "TOP_UP",
  "CORPORATE_TIE_UP",
  "SEASONAL",
  "LOYALTY",
  "GOVERNMENT",
] as const;

const STATUS_VARIANTS: Record<string, "success" | "warning" | "secondary" | "destructive" | "default"> = {
  ACTIVE: "success",
  UPCOMING: "warning",
  EXPIRED: "secondary",
  INACTIVE: "destructive",
};

const TYPE_COLORS: Record<string, string> = {
  FESTIVE: "bg-orange-100 text-orange-700",
  PROMOTIONAL: "bg-blue-100 text-blue-700",
  BALANCE_TRANSFER: "bg-purple-100 text-purple-700",
  TOP_UP: "bg-teal-100 text-teal-700",
  CORPORATE_TIE_UP: "bg-indigo-100 text-indigo-700",
  SEASONAL: "bg-yellow-100 text-yellow-700",
  LOYALTY: "bg-pink-100 text-pink-700",
  GOVERNMENT: "bg-green-100 text-green-700",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRupees(paisa: number) {
  const rupees = paisa / 100;
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)} Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(2)} L`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

function UtilizationBar({
  current,
  max,
  label,
}: {
  current: number;
  max?: number | null;
  label: string;
}) {
  if (!max) {
    return (
      <div className="text-xs text-gray-400">
        {label}: {current} (no cap)
      </div>
    );
  }
  const pct = Math.min(Math.round((current / max) * 100), 100);
  const color =
    pct >= 90
      ? "bg-red-500"
      : pct >= 70
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>
          {current} / {max} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BenefitsSummary({ benefits }: { benefits: SchemeBenefits }) {
  const items: string[] = [];
  if (benefits.interestRateDiscountBps) {
    items.push(`-${benefits.interestRateDiscountPercent}% rate`);
  }
  if (benefits.fixedInterestRateBps) {
    items.push(`Fixed ${benefits.fixedInterestRatePercent}%`);
  }
  if (benefits.processingFeeWaiver) {
    items.push("0 PF");
  } else if (benefits.processingFeeDiscountPercent) {
    items.push(`${benefits.processingFeeDiscountPercent}% off PF`);
  }
  if (benefits.cashbackAmountRupees) {
    items.push(`₹${benefits.cashbackAmountRupees} cashback`);
  }
  if (benefits.stampDutyWaiver) items.push("Stamp duty waiver");
  if (items.length === 0) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-0.5 text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full border border-emerald-200"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ── Empty form ───────────────────────────────────────────────────────────────

const emptyForm = {
  schemeCode: "",
  schemeName: "",
  description: "",
  schemeType: "PROMOTIONAL",
  validFrom: "",
  validTo: "",
  isActive: true,
  // eligibility
  minCibilScore: "",
  minAmountPaisa: "",
  maxAmountPaisa: "",
  minTenureMonths: "",
  maxTenureMonths: "",
  // benefits
  interestRateDiscountBps: "",
  fixedInterestRateBps: "",
  processingFeeDiscountPercent: "",
  processingFeeWaiver: false,
  stampDutyWaiver: false,
  cashbackAmountPaisa: "",
  cashbackCondition: "",
  // limits
  maxDisbursementCount: "",
  maxDisbursementAmountPaisa: "",
  requiresApproval: false,
  approvalAuthority: "",
};

type FormState = typeof emptyForm;

// ── Detail Panel ─────────────────────────────────────────────────────────────

function SchemeDetailPanel({
  scheme,
  onClose,
}: {
  scheme: Scheme;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden border-l border-gray-200">
      {/* Header */}
      <div className="flex items-start justify-between p-6 border-b bg-gray-50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                TYPE_COLORS[scheme.schemeType] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {scheme.schemeType.replace(/_/g, " ")}
            </span>
            <Badge variant={STATUS_VARIANTS[scheme.status] ?? "default"}>
              {scheme.status}
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-gray-900">{scheme.schemeName}</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{scheme.schemeCode}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {scheme.description && (
          <p className="text-sm text-gray-600">{scheme.description}</p>
        )}

        {/* Validity */}
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
            Validity
          </p>
          <p className="text-sm text-blue-900">
            {formatDate(scheme.validFrom)} — {formatDate(scheme.validTo)}
          </p>
          {scheme.product && (
            <p className="text-xs text-blue-600 mt-1">
              Product: {scheme.product.name}
            </p>
          )}
        </div>

        {/* Benefits */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <Gift className="h-4 w-4 text-emerald-500" />
            Benefits
          </h3>
          <div className="space-y-2">
            {scheme.benefits.interestRateDiscountBps && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingDown className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span>
                  Rate discount:{" "}
                  <strong>{scheme.benefits.interestRateDiscountPercent}%</strong> (
                  {scheme.benefits.interestRateDiscountBps} bps)
                </span>
              </div>
            )}
            {scheme.benefits.fixedInterestRateBps && (
              <div className="flex items-center gap-2 text-sm">
                <Percent className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span>
                  Fixed rate:{" "}
                  <strong>{scheme.benefits.fixedInterestRatePercent}% p.a.</strong>
                </span>
              </div>
            )}
            {scheme.benefits.processingFeeWaiver && (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <Tag className="h-4 w-4 flex-shrink-0" />
                <span>Processing fee: <strong>100% waived</strong></span>
              </div>
            )}
            {!scheme.benefits.processingFeeWaiver &&
              scheme.benefits.processingFeeDiscountPercent && (
                <div className="flex items-center gap-2 text-sm">
                  <Tag className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span>
                    Processing fee discount:{" "}
                    <strong>{scheme.benefits.processingFeeDiscountPercent}%</strong>
                  </span>
                </div>
              )}
            {scheme.benefits.stampDutyWaiver && (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <Tag className="h-4 w-4 flex-shrink-0" />
                <span>Stamp duty waived</span>
              </div>
            )}
            {scheme.benefits.cashbackAmountRupees && (
              <div className="flex items-center gap-2 text-sm">
                <Gift className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <span>
                  Cashback: <strong>₹{scheme.benefits.cashbackAmountRupees}</strong>
                  {scheme.benefits.cashbackCondition && (
                    <span className="text-gray-500 ml-1">
                      ({scheme.benefits.cashbackCondition.replace(/_/g, " ").toLowerCase()})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Eligibility */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Eligibility Criteria</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            {scheme.eligibility.minCibilScore && (
              <div className="flex justify-between">
                <span className="text-gray-500">Min CIBIL</span>
                <span className="font-medium">{String(scheme.eligibility.minCibilScore)}</span>
              </div>
            )}
            {scheme.eligibility.eligibleEmploymentTypes && (
              <div className="flex justify-between">
                <span className="text-gray-500">Employment</span>
                <span className="font-medium">
                  {(scheme.eligibility.eligibleEmploymentTypes as string[]).join(", ")}
                </span>
              </div>
            )}
            {scheme.eligibility.balanceTransferMaxDays && (
              <div className="flex justify-between">
                <span className="text-gray-500">Max DPD (source)</span>
                <span className="font-medium">{String(scheme.eligibility.balanceTransferMaxDays)} days</span>
              </div>
            )}
            {Object.keys(scheme.eligibility).length === 0 && (
              <p className="text-gray-400 text-xs">No specific eligibility restrictions</p>
            )}
          </div>
        </div>

        {/* Utilization */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Utilization</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Applications under scheme</span>
              <span className="font-semibold">{scheme.applicationCount}</span>
            </div>
            <UtilizationBar
              current={scheme.limits.currentDisbursementCount}
              max={scheme.limits.maxDisbursementCount}
              label="Disbursements (count)"
            />
            <UtilizationBar
              current={Math.round(scheme.limits.currentDisbursementAmountRupees)}
              max={
                scheme.limits.maxDisbursementAmountRupees
                  ? Math.round(scheme.limits.maxDisbursementAmountRupees)
                  : null
              }
              label="Disbursements (₹)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SchemesPage() {
  const [schemes] = useState<Scheme[]>(MOCK_SCHEMES);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null);

  const filtered = schemes.filter((s) => {
    const matchSearch =
      s.schemeName.toLowerCase().includes(search.toLowerCase()) ||
      s.schemeCode.toLowerCase().includes(search.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "ALL" || s.schemeType === filterType;
    const matchStatus = filterStatus === "ALL" || s.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const openCreate = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };

  const handleSave = () => {
    // In production this calls POST /api/v1/schemes
    setModalOpen(false);
  };

  const field = (key: keyof FormState, label: string, type = "text", opts?: Record<string, unknown>) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <Input
        type={type}
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...(opts as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheme Master</h1>
          <p className="text-sm text-gray-500 mt-1">
            {schemes.filter((s) => s.status === "ACTIVE").length} active schemes
            &nbsp;·&nbsp;
            {schemes.filter((s) => s.status === "UPCOMING").length} upcoming
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create Scheme
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(
          [
            { label: "Active", status: "ACTIVE", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
            { label: "Upcoming", status: "UPCOMING", color: "text-amber-600 bg-amber-50 border-amber-200" },
            { label: "Expired", status: "EXPIRED", color: "text-gray-600 bg-gray-50 border-gray-200" },
            { label: "Inactive", status: "INACTIVE", color: "text-red-600 bg-red-50 border-red-200" },
          ] as const
        ).map(({ label, status, color }) => (
          <div key={status} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-2xl font-bold">
              {schemes.filter((s) => s.status === status).length}
            </p>
            <p className="text-sm font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search schemes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-44"
              >
                <option value="ALL">All Types</option>
                {SCHEME_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-36"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="EXPIRED">Expired</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scheme</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Benefits</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-gray-400 py-16"
                  >
                    No schemes found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((scheme) => (
                  <TableRow
                    key={scheme.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedScheme(scheme)}
                  >
                    {/* Name */}
                    <TableCell>
                      <p className="font-medium text-gray-900">{scheme.schemeName}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        {scheme.schemeCode}
                      </p>
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          TYPE_COLORS[scheme.schemeType] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {scheme.schemeType.replace(/_/g, " ")}
                      </span>
                    </TableCell>

                    {/* Product */}
                    <TableCell className="text-sm text-gray-600">
                      {scheme.product?.name ?? (
                        <span className="text-gray-400 italic">All Products</span>
                      )}
                    </TableCell>

                    {/* Validity */}
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                      <div>{formatDate(scheme.validFrom)}</div>
                      <div className="text-gray-400">to {formatDate(scheme.validTo)}</div>
                    </TableCell>

                    {/* Benefits */}
                    <TableCell>
                      <BenefitsSummary benefits={scheme.benefits} />
                    </TableCell>

                    {/* Utilization */}
                    <TableCell className="min-w-[140px]">
                      <div className="space-y-2">
                        <UtilizationBar
                          current={scheme.limits.currentDisbursementCount}
                          max={scheme.limits.maxDisbursementCount}
                          label="Count"
                        />
                        <UtilizationBar
                          current={Math.round(scheme.limits.currentDisbursementAmountRupees)}
                          max={
                            scheme.limits.maxDisbursementAmountRupees
                              ? Math.round(scheme.limits.maxDisbursementAmountRupees)
                              : null
                          }
                          label="Amount"
                        />
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[scheme.status] ?? "default"}>
                        {scheme.status}
                      </Badge>
                    </TableCell>

                    {/* Arrow */}
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail panel */}
      {selectedScheme && (
        <SchemeDetailPanel
          scheme={selectedScheme}
          onClose={() => setSelectedScheme(null)}
        />
      )}

      {/* Create Scheme Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Scheme"
        description="Define a new promotional lending scheme"
        className="max-w-3xl"
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Basic Info */}
          <fieldset className="border border-gray-200 rounded-lg p-4">
            <legend className="text-sm font-semibold text-gray-700 px-2">
              Basic Information
            </legend>
            <div className="grid grid-cols-2 gap-4 mt-2">
              {field("schemeCode", "Scheme Code *", "text", { placeholder: "e.g. DIWALI-2026", className: "font-mono" })}
              {field("schemeName", "Scheme Name *", "text", { placeholder: "Diwali Dhamaka 2026" })}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Brief description of the scheme..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Scheme Type *
                </label>
                <Select
                  value={form.schemeType}
                  onChange={(e) => setForm({ ...form, schemeType: e.target.value })}
                >
                  {SCHEME_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="text-sm font-medium text-gray-700">Active</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.isActive ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {field("validFrom", "Valid From *", "date")}
              {field("validTo", "Valid To *", "date")}
            </div>
          </fieldset>

          {/* Eligibility */}
          <fieldset className="border border-gray-200 rounded-lg p-4">
            <legend className="text-sm font-semibold text-gray-700 px-2">
              Eligibility Criteria (optional)
            </legend>
            <div className="grid grid-cols-2 gap-4 mt-2">
              {field("minCibilScore", "Min CIBIL Score", "number", { min: 300, max: 900, placeholder: "e.g. 700" })}
              {field("minAmountPaisa", "Min Loan Amount (₹)", "number", { min: 0, placeholder: "e.g. 100000" })}
              {field("maxAmountPaisa", "Max Loan Amount (₹)", "number", { min: 0, placeholder: "e.g. 5000000" })}
              {field("minTenureMonths", "Min Tenure (months)", "number", { min: 1 })}
              {field("maxTenureMonths", "Max Tenure (months)", "number", { min: 1 })}
            </div>
          </fieldset>

          {/* Benefits */}
          <fieldset className="border border-gray-200 rounded-lg p-4">
            <legend className="text-sm font-semibold text-gray-700 px-2">
              Benefits
            </legend>
            <div className="grid grid-cols-2 gap-4 mt-2">
              {field("interestRateDiscountBps", "Rate Discount (bps)", "number", { placeholder: "e.g. 200 = 2% off" })}
              {field("fixedInterestRateBps", "Fixed Rate (bps)", "number", { placeholder: "e.g. 1100 = 11% fixed" })}
              {field("processingFeeDiscountPercent", "PF Discount %", "number", { min: 0, max: 100 })}
              <div className="flex items-center gap-6 pt-5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.processingFeeWaiver}
                    onChange={(e) =>
                      setForm({ ...form, processingFeeWaiver: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  PF Waiver
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.stampDutyWaiver}
                    onChange={(e) =>
                      setForm({ ...form, stampDutyWaiver: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  Stamp Duty Waiver
                </label>
              </div>
              {field("cashbackAmountPaisa", "Cashback Amount (₹)", "number", { min: 0 })}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Cashback Condition
                </label>
                <Select
                  value={form.cashbackCondition}
                  onChange={(e) => setForm({ ...form, cashbackCondition: e.target.value })}
                >
                  <option value="">None</option>
                  <option value="AT_DISBURSAL">At Disbursal</option>
                  <option value="AFTER_3_EMI_PAID">After 3 EMIs Paid</option>
                  <option value="AFTER_6_EMI_PAID">After 6 EMIs Paid</option>
                  <option value="AFTER_12_EMI_PAID">After 12 EMIs Paid</option>
                </Select>
              </div>
            </div>
          </fieldset>

          {/* Limits */}
          <fieldset className="border border-gray-200 rounded-lg p-4">
            <legend className="text-sm font-semibold text-gray-700 px-2">
              Budget Limits (optional)
            </legend>
            <div className="grid grid-cols-2 gap-4 mt-2">
              {field("maxDisbursementCount", "Max Disbursements (count)", "number", { min: 1 })}
              {field("maxDisbursementAmountPaisa", "Max Disbursal Budget (₹)", "number", { min: 0 })}
            </div>
          </fieldset>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!form.schemeCode || !form.schemeName || !form.validFrom || !form.validTo}
          >
            Create Scheme
          </Button>
        </div>
      </Modal>
    </div>
  );
}
