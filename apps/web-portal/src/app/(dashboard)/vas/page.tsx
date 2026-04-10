"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  DollarSign,
  Percent,
  Layers,
  Calculator,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  Zap,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ── Types ───────────────────────────────────────────────────────────────────

interface FeeTemplate {
  id: string;
  templateName: string;
  feeCode: string;
  feeCategory: string;
  description?: string | null;
  isActive: boolean;
  calculationType: string;
  flatAmountRupees?: number | null;
  percentageValue?: number | null;
  percentageBase?: string | null;
  minCapRupees?: number | null;
  maxCapRupees?: number | null;
  slabs?: Array<{ upToPaisa: number | null; flatPaisa?: number; percent?: number }> | null;
  gstApplicable: boolean;
  gstPercent: number;
  collectAt: string;
  deductFromDisbursement: boolean;
  isNegotiable: boolean;
  maxDiscountPercent?: number | null;
  showInSanctionLetter: boolean;
  showInKFS: boolean;
  displayOrder: number;
  triggerEvent?: string | null;
  _usageCount?: number;
}

interface AppliedFee {
  id: string;
  feeCode: string;
  feeName: string;
  baseAmountRupees: number;
  gstAmountRupees: number;
  cessAmountRupees: number;
  totalAmountRupees: number;
  discountRupees: number;
  waivedRupees: number;
  netPayableRupees: number;
  status: string;
  deductedFromDisbursement: boolean;
}

interface FeeSummary {
  totalFeesRupees: number;
  totalGstRupees: number;
  netPayableRupees: number;
  deductedFromDisbursementRupees: number;
  feeCount: number;
}

// ── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_TEMPLATES: FeeTemplate[] = [
  {
    id: "ft1",
    templateName: "Processing Fee",
    feeCode: "PROCESSING_FEE",
    feeCategory: "ORIGINATION",
    description: "One-time processing fee for loan origination",
    isActive: true,
    calculationType: "PERCENTAGE",
    percentageValue: 2.0,
    percentageBase: "LOAN_AMOUNT",
    minCapRupees: 2000,
    maxCapRupees: 25000,
    gstApplicable: true,
    gstPercent: 18,
    collectAt: "DISBURSAL",
    deductFromDisbursement: true,
    isNegotiable: true,
    maxDiscountPercent: 50,
    showInSanctionLetter: true,
    showInKFS: true,
    displayOrder: 1,
    triggerEvent: "DISBURSAL",
    _usageCount: 42,
  },
  {
    id: "ft2",
    templateName: "Login Fee",
    feeCode: "LOGIN_FEE",
    feeCategory: "ORIGINATION",
    description: "Non-refundable application processing fee collected upfront",
    isActive: true,
    calculationType: "FLAT",
    flatAmountRupees: 500,
    gstApplicable: true,
    gstPercent: 18,
    collectAt: "UPFRONT",
    deductFromDisbursement: false,
    isNegotiable: false,
    showInSanctionLetter: true,
    showInKFS: true,
    displayOrder: 2,
    triggerEvent: "DISBURSAL",
    _usageCount: 87,
  },
  {
    id: "ft3",
    templateName: "Documentation Charge",
    feeCode: "DOCUMENTATION_CHARGE",
    feeCategory: "ORIGINATION",
    description: "Charge for preparing loan documentation",
    isActive: true,
    calculationType: "FLAT",
    flatAmountRupees: 1000,
    gstApplicable: true,
    gstPercent: 18,
    collectAt: "DISBURSAL",
    deductFromDisbursement: true,
    isNegotiable: false,
    showInSanctionLetter: true,
    showInKFS: true,
    displayOrder: 3,
    triggerEvent: "DISBURSAL",
    _usageCount: 87,
  },
  {
    id: "ft4",
    templateName: "CIBIL Charge",
    feeCode: "CIBIL_CHARGE",
    feeCategory: "REGULATORY",
    description: "Bureau pull charge per enquiry",
    isActive: true,
    calculationType: "FLAT",
    flatAmountRupees: 50,
    gstApplicable: false,
    gstPercent: 0,
    collectAt: "UPFRONT",
    deductFromDisbursement: false,
    isNegotiable: false,
    showInSanctionLetter: false,
    showInKFS: true,
    displayOrder: 4,
    triggerEvent: "DISBURSAL",
    _usageCount: 124,
  },
  {
    id: "ft5",
    templateName: "Stamp Duty",
    feeCode: "STAMP_DUTY",
    feeCategory: "REGULATORY",
    description: "Stamp duty on loan agreement (slab-based)",
    isActive: true,
    calculationType: "SLAB",
    slabs: [
      { upToPaisa: 50000000, flatPaisa: 10000 },
      { upToPaisa: 200000000, flatPaisa: 20000 },
      { upToPaisa: null, flatPaisa: 50000 },
    ],
    gstApplicable: false,
    gstPercent: 0,
    collectAt: "DISBURSAL",
    deductFromDisbursement: true,
    isNegotiable: false,
    showInSanctionLetter: true,
    showInKFS: true,
    displayOrder: 5,
    triggerEvent: "DISBURSAL",
    _usageCount: 56,
  },
  {
    id: "ft6",
    templateName: "Bounce Charge",
    feeCode: "BOUNCE_CHARGE",
    feeCategory: "PENAL",
    description: "Charge levied on EMI bounce / mandate rejection",
    isActive: true,
    calculationType: "FLAT",
    flatAmountRupees: 500,
    gstApplicable: true,
    gstPercent: 18,
    collectAt: "ON_EVENT",
    deductFromDisbursement: false,
    isNegotiable: false,
    showInSanctionLetter: false,
    showInKFS: true,
    displayOrder: 9,
    triggerEvent: "BOUNCE",
    _usageCount: 31,
  },
  {
    id: "ft7",
    templateName: "Penal Interest",
    feeCode: "PENAL_INTEREST",
    feeCategory: "PENAL",
    description: "Penal interest at 2% per month on overdue amount",
    isActive: true,
    calculationType: "PERCENTAGE",
    percentageValue: 2.0,
    percentageBase: "OVERDUE_AMOUNT",
    gstApplicable: true,
    gstPercent: 18,
    collectAt: "MONTHLY",
    deductFromDisbursement: false,
    isNegotiable: false,
    showInSanctionLetter: false,
    showInKFS: true,
    displayOrder: 10,
    triggerEvent: "MONTHLY",
    _usageCount: 18,
  },
  {
    id: "ft8",
    templateName: "Foreclosure Charge",
    feeCode: "FORECLOSURE_CHARGE",
    feeCategory: "CLOSURE",
    description: "Foreclosure charge on outstanding principal (slab-based)",
    isActive: true,
    calculationType: "SLAB",
    slabs: [
      { upToPaisa: 50000000, percent: 5.0 },
      { upToPaisa: 200000000, percent: 3.0 },
      { upToPaisa: null, percent: 2.0 },
    ],
    gstApplicable: true,
    gstPercent: 18,
    collectAt: "ON_EVENT",
    deductFromDisbursement: false,
    isNegotiable: true,
    maxDiscountPercent: 25,
    showInSanctionLetter: true,
    showInKFS: true,
    displayOrder: 12,
    triggerEvent: "FORECLOSURE",
    _usageCount: 7,
  },
];

const MOCK_APPLIED_FEES: AppliedFee[] = [
  { id: "af1", feeCode: "PROCESSING_FEE", feeName: "Processing Fee", baseAmountRupees: 4000, gstAmountRupees: 720, cessAmountRupees: 0, totalAmountRupees: 4720, discountRupees: 0, waivedRupees: 0, netPayableRupees: 4720, status: "CALCULATED", deductedFromDisbursement: true },
  { id: "af2", feeCode: "LOGIN_FEE", feeName: "Login Fee", baseAmountRupees: 500, gstAmountRupees: 90, cessAmountRupees: 0, totalAmountRupees: 590, discountRupees: 0, waivedRupees: 0, netPayableRupees: 590, status: "COLLECTED", deductedFromDisbursement: false },
  { id: "af3", feeCode: "DOCUMENTATION_CHARGE", feeName: "Documentation Charge", baseAmountRupees: 1000, gstAmountRupees: 180, cessAmountRupees: 0, totalAmountRupees: 1180, discountRupees: 0, waivedRupees: 0, netPayableRupees: 1180, status: "CALCULATED", deductedFromDisbursement: true },
  { id: "af4", feeCode: "CIBIL_CHARGE", feeName: "CIBIL Charge", baseAmountRupees: 50, gstAmountRupees: 0, cessAmountRupees: 0, totalAmountRupees: 50, discountRupees: 0, waivedRupees: 0, netPayableRupees: 50, status: "COLLECTED", deductedFromDisbursement: false },
  { id: "af5", feeCode: "STAMP_DUTY", feeName: "Stamp Duty", baseAmountRupees: 200, gstAmountRupees: 0, cessAmountRupees: 0, totalAmountRupees: 200, discountRupees: 0, waivedRupees: 0, netPayableRupees: 200, status: "CALCULATED", deductedFromDisbursement: true },
  { id: "af6", feeCode: "NACH_CHARGE", feeName: "NACH Registration", baseAmountRupees: 300, gstAmountRupees: 54, cessAmountRupees: 0, totalAmountRupees: 354, discountRupees: 0, waivedRupees: 354, netPayableRupees: 0, status: "WAIVED", deductedFromDisbursement: false },
];

const MOCK_SUMMARY: FeeSummary = {
  totalFeesRupees: 7094,
  totalGstRupees: 1044,
  netPayableRupees: 6740,
  deductedFromDisbursementRupees: 5580,
  feeCount: 6,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryColor(category: string): string {
  switch (category) {
    case "ORIGINATION": return "success";
    case "SERVICING": return "default";
    case "PENAL": return "destructive";
    case "CLOSURE": return "warning";
    case "COLLECTION": return "secondary";
    case "REGULATORY": return "outline";
    default: return "secondary";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "COLLECTED": return "success";
    case "WAIVED": return "secondary";
    case "CALCULATED": return "default";
    case "APPROVED": return "warning";
    default: return "outline";
  }
}

function describeCalculation(t: FeeTemplate): string {
  switch (t.calculationType) {
    case "FLAT":
      return `Flat ₹${t.flatAmountRupees?.toLocaleString("en-IN")}`;
    case "PERCENTAGE": {
      let desc = `${t.percentageValue}% of ${t.percentageBase?.replace(/_/g, " ")}`;
      if (t.minCapRupees) desc += ` (min ₹${t.minCapRupees.toLocaleString("en-IN")})`;
      if (t.maxCapRupees) desc += ` (max ₹${t.maxCapRupees.toLocaleString("en-IN")})`;
      return desc;
    }
    case "SLAB":
      return `${t.slabs?.length ?? 0}-tier slab`;
    case "PER_UNIT":
      return `Per unit`;
    case "FORMULA":
      return "Custom formula";
    default:
      return t.calculationType;
  }
}

function formatRupees(val: number): string {
  return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Create Template Modal ─────────────────────────────────────────────────────

function CreateTemplateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    templateName: "",
    feeCode: "PROCESSING_FEE",
    feeCategory: "ORIGINATION",
    calculationType: "FLAT",
    flatAmount: "",
    percentageValue: "",
    percentageBase: "LOAN_AMOUNT",
    minCap: "",
    maxCap: "",
    gstPercent: "18",
    collectAt: "DISBURSAL",
    deductFromDisbursement: false,
    isNegotiable: false,
    maxDiscountPercent: "",
    triggerEvent: "DISBURSAL",
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="Create Fee Template">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Template Name</label>
            <Input
              placeholder="e.g. Processing Fee"
              value={form.templateName}
              onChange={(e) => set("templateName", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fee Code</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.feeCode}
              onChange={(e) => set("feeCode", e.target.value)}
            >
              {["PROCESSING_FEE","LOGIN_FEE","DOCUMENTATION_CHARGE","LEGAL_FEE","VALUATION_FEE","STAMP_DUTY","INSURANCE_PREMIUM","CIBIL_CHARGE","NACH_CHARGE","FILE_CHARGE","BOUNCE_CHARGE","PENAL_INTEREST","PREPAYMENT_PENALTY","FORECLOSURE_CHARGE","OTHER"].map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.feeCategory}
              onChange={(e) => set("feeCategory", e.target.value)}
            >
              {["ORIGINATION","SERVICING","PENAL","CLOSURE","COLLECTION","REGULATORY","OTHER"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Calculation Type</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.calculationType}
              onChange={(e) => set("calculationType", e.target.value)}
            >
              {["FLAT","PERCENTAGE","SLAB","PER_UNIT","FORMULA"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Trigger Event</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.triggerEvent}
              onChange={(e) => set("triggerEvent", e.target.value)}
            >
              {["DISBURSAL","BOUNCE","PREPAYMENT","FORECLOSURE","NPA","MANDATE_FAIL","MONTHLY","ANNUAL","ON_DEMAND"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Calculation-specific fields */}
        {form.calculationType === "FLAT" && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Flat Amount (₹)</label>
            <Input placeholder="e.g. 500" value={form.flatAmount} onChange={(e) => set("flatAmount", e.target.value)} />
          </div>
        )}
        {form.calculationType === "PERCENTAGE" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Percentage (%)</label>
              <Input placeholder="e.g. 2.0" value={form.percentageValue} onChange={(e) => set("percentageValue", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Base Amount</label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.percentageBase}
                onChange={(e) => set("percentageBase", e.target.value)}
              >
                {["LOAN_AMOUNT","OUTSTANDING_PRINCIPAL","OVERDUE_AMOUNT","EMI_AMOUNT","DISBURSED_AMOUNT"].map((b) => (
                  <option key={b} value={b}>{b.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Min Cap (₹)</label>
              <Input placeholder="Optional" value={form.minCap} onChange={(e) => set("minCap", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max Cap (₹)</label>
              <Input placeholder="Optional" value={form.maxCap} onChange={(e) => set("maxCap", e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">GST %</label>
            <Input placeholder="18" value={form.gstPercent} onChange={(e) => set("gstPercent", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Collect At</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.collectAt}
              onChange={(e) => set("collectAt", e.target.value)}
            >
              {["DISBURSAL","UPFRONT","POST_DISBURSAL","ON_EVENT","MONTHLY"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 pt-4">
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.deductFromDisbursement} onChange={(e) => set("deductFromDisbursement", e.target.checked)} className="rounded" />
              Deduct from disbursement
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.isNegotiable} onChange={(e) => set("isNegotiable", e.target.checked)} className="rounded" />
              Negotiable
            </label>
          </div>
        </div>

        {form.isNegotiable && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Max Discount (%)</label>
            <Input placeholder="e.g. 50" value={form.maxDiscountPercent} onChange={(e) => set("maxDiscountPercent", e.target.value)} />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onClose}>Create Template</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VasPage() {
  const [templates, setTemplates] = useState<FeeTemplate[]>(MOCK_TEMPLATES);
  const [appliedFees, setAppliedFees] = useState<AppliedFee[]>(MOCK_APPLIED_FEES);
  const [summary] = useState<FeeSummary>(MOCK_SUMMARY);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [appSearch, setAppSearch] = useState("APP-2026-00021");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [waiveTarget, setWaiveTarget] = useState<string | null>(null);
  const [discountTarget, setDiscountTarget] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState("");

  const filteredTemplates = templates.filter((t) => {
    const matchSearch =
      !search ||
      t.templateName.toLowerCase().includes(search.toLowerCase()) ||
      t.feeCode.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      categoryFilter === "ALL" || t.feeCategory === categoryFilter;
    return matchSearch && matchCategory;
  });

  function toggleRow(id: string) {
    setExpandedRow((prev) => (prev === id ? null : id));
  }

  function deactivateTemplate(id: string) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isActive: false } : t))
    );
  }

  function waiveFee(id: string) {
    setAppliedFees((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, status: "WAIVED", waivedRupees: f.totalAmountRupees, netPayableRupees: 0 }
          : f
      )
    );
    setWaiveTarget(null);
  }

  function applyDiscount(id: string) {
    const amt = parseFloat(discountAmount);
    if (!isNaN(amt) && amt > 0) {
      setAppliedFees((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, discountRupees: amt, netPayableRupees: Math.max(0, f.totalAmountRupees - amt) }
            : f
        )
      );
    }
    setDiscountTarget(null);
    setDiscountAmount("");
  }

  // Totals for applied fees table
  const totalBase = appliedFees.reduce((s, f) => s + f.baseAmountRupees, 0);
  const totalGst = appliedFees.reduce((s, f) => s + f.gstAmountRupees, 0);
  const totalNet = appliedFees.reduce((s, f) => s + f.netPayableRupees, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">VAS / Fees</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Dynamic fee template engine — auto-calculates all charges for each loan application
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Template
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Active Templates</p>
                <p className="text-xl font-bold text-gray-900">
                  {templates.filter((t) => t.isActive).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2.5">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Net Payable</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatRupees(summary.netPayableRupees)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2.5">
                <Percent className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total GST</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatRupees(summary.totalGstRupees)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-50 p-2.5">
                <Calculator className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Deducted at Disbursal</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatRupees(summary.deductedFromDisbursementRupees)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="templates">
        <TabsList className="mb-0">
          <TabsTrigger value="templates">Fee Templates</TabsTrigger>
          <TabsTrigger value="applied">Applied Fees</TabsTrigger>
        </TabsList>

        {/* ── Fee Templates Tab ─────────────────────────────────────────── */}
        <TabsContent value="templates">
          <Card>
            <CardHeader className="border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search by name or fee code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="ALL">All Categories</option>
                  {["ORIGINATION","SERVICING","PENAL","CLOSURE","COLLECTION","REGULATORY","OTHER"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Template / Fee Code</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Calculation</TableHead>
                    <TableHead>GST</TableHead>
                    <TableHead>Collect At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((t) => (
                    <>
                      <TableRow
                        key={t.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleRow(t.id)}
                      >
                        <TableCell>
                          {expandedRow === t.id ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{t.templateName}</p>
                            <p className="text-xs text-gray-400 font-mono">{t.feeCode}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getCategoryColor(t.feeCategory) as "success" | "default" | "secondary" | "destructive" | "warning" | "outline"}>
                            {t.feeCategory}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-700">{describeCalculation(t)}</span>
                        </TableCell>
                        <TableCell>
                          {t.gstApplicable ? (
                            <span className="text-sm text-gray-700">{t.gstPercent}%</span>
                          ) : (
                            <span className="text-xs text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-600 font-mono">{t.collectAt}</span>
                        </TableCell>
                        <TableCell>
                          {t.isActive ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">{t._usageCount ?? 0}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600" title="Edit">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            {t.isActive && (
                              <button
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600"
                                title="Deactivate"
                                onClick={() => deactivateTemplate(t.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded row */}
                      {expandedRow === t.id && (
                        <TableRow key={`${t.id}-expanded`} className="bg-blue-50/30">
                          <TableCell colSpan={9} className="py-3 px-6">
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs text-gray-600">
                              <div>
                                <span className="font-medium text-gray-700">Description</span>
                                <p className="mt-0.5">{t.description ?? "—"}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Trigger Event</span>
                                <p className="mt-0.5 font-mono">{t.triggerEvent ?? "—"}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Deduct from Disbursal</span>
                                <p className="mt-0.5">{t.deductFromDisbursement ? "Yes" : "No"}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Negotiable</span>
                                <p className="mt-0.5">
                                  {t.isNegotiable
                                    ? `Yes (max ${t.maxDiscountPercent}% discount)`
                                    : "No"}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Show in Sanction Letter</span>
                                <p className="mt-0.5">{t.showInSanctionLetter ? "Yes" : "No"}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Show in KFS</span>
                                <p className="mt-0.5">{t.showInKFS ? "Yes" : "No"}</p>
                              </div>
                              {t.calculationType === "SLAB" && t.slabs && (
                                <div className="col-span-2">
                                  <span className="font-medium text-gray-700">Slabs</span>
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    {t.slabs.map((s, i) => (
                                      <span key={i} className="inline-flex items-center rounded bg-white border border-gray-200 px-2 py-0.5 text-xs">
                                        {s.upToPaisa
                                          ? `up to ₹${(s.upToPaisa / 100).toLocaleString("en-IN")}`
                                          : "above"}{" "}
                                        →{" "}
                                        {s.flatPaisa
                                          ? `₹${(s.flatPaisa / 100).toLocaleString("en-IN")}`
                                          : `${s.percent}%`}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
              {filteredTemplates.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-sm">
                  No fee templates found. Create your first template.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Applied Fees Tab ──────────────────────────────────────────── */}
        <TabsContent value="applied">
          <Card>
            <CardHeader className="border-b border-gray-100">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Enter Application Number..."
                    value={appSearch}
                    onChange={(e) => setAppSearch(e.target.value)}
                  />
                </div>
                <Button variant="outline">
                  <Search className="h-4 w-4 mr-1.5" />
                  Search
                </Button>
                <Button>
                  <Zap className="h-4 w-4 mr-1.5" />
                  Calculate Fees
                </Button>
                <Button variant="outline">
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Recalculate
                </Button>
              </div>
            </CardHeader>

            {/* Application context banner */}
            {appSearch && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold">{appSearch}</span>
                  <span className="mx-2 text-blue-400">|</span>
                  <span>Vehicle Finance</span>
                  <span className="mx-2 text-blue-400">|</span>
                  <span>Sanctioned: ₹8,00,000 @ 14% for 48 months</span>
                  <span className="mx-2 text-blue-400">|</span>
                  <span className="font-medium">Rajesh Kumar</span>
                </div>
                <Badge variant="default">SANCTIONED</Badge>
              </div>
            )}

            <CardContent className="p-0 mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fee Name</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Waived</TableHead>
                    <TableHead className="text-right">Net Payable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deduct</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appliedFees.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm text-gray-900">{f.feeName}</p>
                          <p className="text-xs text-gray-400 font-mono">{f.feeCode}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatRupees(f.baseAmountRupees)}</TableCell>
                      <TableCell className="text-right text-sm">{formatRupees(f.gstAmountRupees)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatRupees(f.totalAmountRupees)}</TableCell>
                      <TableCell className="text-right text-sm text-blue-600">
                        {f.discountRupees > 0 ? formatRupees(f.discountRupees) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-amber-600">
                        {f.waivedRupees > 0 ? formatRupees(f.waivedRupees) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-gray-900">
                        {formatRupees(f.netPayableRupees)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(f.status) as "success" | "default" | "secondary" | "destructive" | "warning" | "outline"}>
                          {f.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {f.deductedFromDisbursement ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-300" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {f.status !== "WAIVED" && f.status !== "COLLECTED" && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                              onClick={() => setDiscountTarget(f.id)}
                            >
                              Discount
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium"
                              onClick={() => setWaiveTarget(f.id)}
                            >
                              Waive
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Total row */}
                  <TableRow className="bg-gray-50 font-semibold">
                    <TableCell className="text-sm text-gray-900">
                      Total ({appliedFees.length} fees)
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatRupees(totalBase)}</TableCell>
                    <TableCell className="text-right text-sm">{formatRupees(totalGst)}</TableCell>
                    <TableCell className="text-right text-sm">{formatRupees(totalBase + totalGst)}</TableCell>
                    <TableCell className="text-right text-sm text-blue-600">
                      {formatRupees(appliedFees.reduce((s, f) => s + f.discountRupees, 0))}
                    </TableCell>
                    <TableCell className="text-right text-sm text-amber-600">
                      {formatRupees(appliedFees.reduce((s, f) => s + f.waivedRupees, 0))}
                    </TableCell>
                    <TableCell className="text-right text-sm font-bold text-gray-900">
                      {formatRupees(totalNet)}
                    </TableCell>
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* Disbursement deduction summary */}
              <div className="mx-6 mb-6 mt-4 p-3 rounded-lg bg-green-50 border border-green-100">
                <p className="text-xs font-semibold text-green-800 mb-2">Disbursement Deduction Summary</p>
                <div className="flex gap-6 text-sm text-green-700">
                  <div>
                    <span className="text-xs text-green-600">Sanctioned Amount</span>
                    <p className="font-semibold">₹8,00,000.00</p>
                  </div>
                  <div>
                    <span className="text-xs text-green-600">Less: Deductions</span>
                    <p className="font-semibold text-red-600">- ₹5,580.00</p>
                  </div>
                  <div>
                    <span className="text-xs text-green-600">Net Disbursement</span>
                    <p className="font-bold text-green-800 text-base">₹7,94,420.00</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Template Modal */}
      <CreateTemplateModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Waive Confirmation Modal */}
      {waiveTarget && (
        <Modal
          open={true}
          onClose={() => setWaiveTarget(null)}
          title="Waive Fee"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to waive this fee entirely? This action will set the net payable amount to ₹0.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason (required)</label>
              <Input placeholder="Enter reason for waiver..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setWaiveTarget(null)}>Cancel</Button>
              <Button onClick={() => waiveFee(waiveTarget)}>Confirm Waiver</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Discount Modal */}
      {discountTarget && (
        <Modal
          open={true}
          onClose={() => { setDiscountTarget(null); setDiscountAmount(""); }}
          title="Apply Discount"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter the discount amount in rupees. The discount cannot exceed the maximum negotiable limit for this fee.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Discount Amount (₹)</label>
              <Input
                placeholder="e.g. 500"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
              <Input placeholder="Enter reason for discount..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDiscountTarget(null); setDiscountAmount(""); }}>Cancel</Button>
              <Button onClick={() => applyDiscount(discountTarget)}>Apply Discount</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
