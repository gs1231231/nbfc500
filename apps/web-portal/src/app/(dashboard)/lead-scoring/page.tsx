"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  Star,
  BarChart3,
  Zap,
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle,
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
import { LeadScoreBadge, LeadScoreChip } from "@/components/lead-score/LeadScoreBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GradeDistributionItem {
  grade: string;
  gradeLabel: string;
  count: number;
  percentage: string;
  avgScore: number;
  minScore: number;
  maxScore: number;
  color: string;
}

interface ConversionItem {
  grade: string;
  totalScored: number;
  disbursed: number;
  conversionRate: string;
}

interface LeaderboardItem {
  scoreId: string;
  applicationId: string;
  applicationNumber: string;
  applicationStatus: string;
  requestedAmountRupees: string;
  sourceType: string;
  product: { name: string; productType: string } | null;
  branch: { name: string; code: string } | null;
  customer: {
    id: string;
    customerNumber: string;
    fullName: string;
    phone: string;
    employmentType: string;
    kycStatus: string;
  };
  assignedTo: { firstName: string; lastName: string; id: string } | null;
  totalScore: number;
  grade: string;
  gradeLabel: string;
  recommendedAction: string | null;
  version: number;
  scoredAt: string;
  createdAt: string;
}

interface FactorScore {
  factorCode: string;
  factorName: string;
  category: string;
  maxPoints: number;
  earnedPoints: number;
  matchedRule: string | null;
  rawValue: unknown;
}

interface ScoreDetail {
  applicationId: string;
  applicationNumber: string;
  customerId: string;
  customerName: string;
  configId: string;
  configName: string;
  totalScore: number;
  grade: string;
  gradeLabel: string;
  gradeColor: string;
  recommendedAction: string | null;
  previousScore: number | null;
  scoreChange: number | null;
  version: number;
  factorScores: FactorScore[];
  autoAssignRole: string | null;
  autoNotifyChannels: string[];
  scoredAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const GRADE_LABELS: Record<string, string> = {
  A: "Hot Lead",
  B: "Warm Lead",
  C: "Cool Lead",
  D: "Cold Lead",
  F: "Unqualified",
};

const ACTION_COLORS: Record<string, string> = {
  CALL_WITHIN_1_HOUR: "bg-green-100 text-green-700",
  CALL_WITHIN_4_HOURS: "bg-yellow-100 text-yellow-700",
  CALL_WITHIN_24_HOURS: "bg-orange-100 text-orange-700",
  NURTURE_CAMPAIGN: "bg-red-100 text-red-700",
  DEPRIORITIZE: "bg-gray-100 text-gray-600",
};

function formatAction(action: string | null): string {
  if (!action) return "—";
  return action
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatAmount(rupees: string): string {
  const n = parseFloat(rupees);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)} K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

// ── Grade Distribution Chart ──────────────────────────────────────────────────

function GradeDistributionChart({
  distribution,
  total,
}: {
  distribution: GradeDistributionItem[];
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400">
        <BarChart3 className="h-12 w-12 mb-2 opacity-40" />
        <p className="text-sm">No scored leads yet. Run bulk scoring first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {distribution.map((item) => (
        <div key={item.grade} className="flex items-center gap-3">
          <div className="w-6 text-center">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: item.color }}
            >
              {item.grade}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span className="font-medium">{item.gradeLabel}</span>
              <span>
                {item.count} ({item.percentage}%)
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
          <div className="w-14 text-right text-xs text-gray-500">
            avg {item.avgScore}
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-400 pt-1">Total scored: {total}</p>
    </div>
  );
}

// ── Conversion Stats ──────────────────────────────────────────────────────────

function ConversionStats({ data }: { data: ConversionItem[] }) {
  const gradeColors: Record<string, string> = {
    A: "#22c55e",
    B: "#eab308",
    C: "#f97316",
    D: "#ef4444",
    F: "#6b7280",
  };

  return (
    <div className="grid grid-cols-5 gap-2">
      {data.map((item) => (
        <div
          key={item.grade}
          className="text-center p-3 rounded-lg bg-gray-50 border border-gray-100"
        >
          <div
            className="text-2xl font-bold mb-1"
            style={{ color: gradeColors[item.grade] }}
          >
            {item.conversionRate}%
          </div>
          <div className="text-xs text-gray-500 mb-1">
            {GRADE_LABELS[item.grade] ?? item.grade}
          </div>
          <div className="text-[10px] text-gray-400">
            {item.disbursed}/{item.totalScored}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Score Breakdown Modal ─────────────────────────────────────────────────────

function ScoreBreakdownModal({
  open,
  onClose,
  detail,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  detail: ScoreDetail | null;
  loading: boolean;
}) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        detail
          ? `Score Breakdown — ${detail.applicationNumber}`
          : "Score Breakdown"
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      )}

      {!loading && detail && (
        <div className="space-y-5">
          {/* Header score */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">Customer</p>
              <p className="font-semibold">{detail.customerName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {detail.configName} · v{detail.version}
              </p>
            </div>
            <LeadScoreBadge
              score={detail.totalScore}
              grade={detail.grade}
              gradeLabel={detail.gradeLabel}
              size="lg"
            />
          </div>

          {/* Score delta */}
          {detail.previousScore !== null && (
            <div className="flex items-center gap-2 text-sm px-1">
              <span className="text-gray-500">Previous score:</span>
              <span className="font-medium">{detail.previousScore}</span>
              <span
                className={
                  (detail.scoreChange ?? 0) >= 0
                    ? "text-green-600 font-medium"
                    : "text-red-500 font-medium"
                }
              >
                {(detail.scoreChange ?? 0) >= 0 ? "+" : ""}
                {detail.scoreChange}
              </span>
            </div>
          )}

          {/* Recommended action */}
          {detail.recommendedAction && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                ACTION_COLORS[detail.recommendedAction] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              <Zap className="h-4 w-4 flex-shrink-0" />
              {formatAction(detail.recommendedAction)}
              {detail.autoAssignRole && (
                <span className="ml-auto text-xs opacity-70">
                  Auto-assign: {detail.autoAssignRole.replace(/_/g, " ")}
                </span>
              )}
            </div>
          )}

          {/* Factor breakdown */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Factor Breakdown
            </h4>
            <div className="space-y-2.5">
              {detail.factorScores.map((factor) => {
                const pct =
                  factor.maxPoints > 0
                    ? (factor.earnedPoints / factor.maxPoints) * 100
                    : 0;
                const barColor =
                  pct >= 80
                    ? "#22c55e"
                    : pct >= 50
                    ? "#eab308"
                    : pct > 0
                    ? "#f97316"
                    : "#e5e7eb";

                return (
                  <div key={factor.factorCode} className="group">
                    <div className="flex justify-between items-baseline mb-1">
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          {factor.factorName}
                        </span>
                        <span className="ml-2 text-xs text-gray-400">
                          [{factor.category}]
                        </span>
                      </div>
                      <span className="text-sm font-semibold">
                        {factor.earnedPoints}
                        <span className="text-gray-400 font-normal">
                          /{factor.maxPoints}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                    {factor.matchedRule && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {factor.matchedRule}
                      </p>
                    )}
                    {!factor.matchedRule && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-gray-400" />
                        No rule matched (0 pts)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center border-t pt-3">
            <span className="font-semibold text-gray-700">Total Score</span>
            <span className="text-xl font-bold text-gray-900">
              {detail.totalScore}
              <span className="text-gray-400 text-base font-normal">/100</span>
            </span>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadScoringPage() {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "analytics">(
    "leaderboard"
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [distribution, setDistribution] = useState<GradeDistributionItem[]>([]);
  const [distTotal, setDistTotal] = useState(0);
  const [conversion, setConversion] = useState<ConversionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [gradeFilter, setGradeFilter] = useState("");
  const [scoreSearch, setScoreSearch] = useState("");

  // Score detail modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalDetail, setModalDetail] = useState<ScoreDetail | null>(null);

  // ── Fetch Functions ──────────────────────────────────────────────────────

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (gradeFilter) params.set("grade", gradeFilter);

      const res = await fetch(
        `${API}/api/v1/lead-scoring/leaderboard?${params}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setLeaderboard(data.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch leaderboard");
    } finally {
      setLoading(false);
    }
  }, [gradeFilter]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [distRes, convRes] = await Promise.all([
        fetch(`${API}/api/v1/lead-scoring/grade-distribution`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API}/api/v1/lead-scoring/conversion-by-grade`, {
          headers: getAuthHeaders(),
        }),
      ]);

      if (distRes.ok) {
        const d = await distRes.json();
        setDistribution(d.distribution ?? []);
        setDistTotal(d.total ?? 0);
      }
      if (convRes.ok) {
        const c = await convRes.json();
        setConversion(c.conversionByGrade ?? []);
      }
    } catch {
      // silent — analytics are supplementary
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    fetchAnalytics();
  }, [fetchLeaderboard, fetchAnalytics]);

  const handleBulkScore = async () => {
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const res = await fetch(`${API}/api/v1/lead-scoring/bulk-score`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setBulkResult(
        `Scored ${data.processed} applications (${data.errors} errors)`
      );
      fetchLeaderboard();
      fetchAnalytics();
    } catch (e) {
      setBulkResult("Bulk scoring failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleScore = async (applicationId: string) => {
    setModalOpen(true);
    setModalLoading(true);
    setModalDetail(null);
    try {
      // Score first
      await fetch(`${API}/api/v1/lead-scoring/score/${applicationId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      // Then fetch the result
      const res = await fetch(
        `${API}/api/v1/lead-scoring/score/${applicationId}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Reshape for the modal
      setModalDetail({
        applicationId: data.applicationId,
        applicationNumber: data.application?.applicationNumber ?? applicationId,
        customerId: data.customerId,
        customerName: data.customer?.fullName ?? "—",
        configId: data.configId,
        configName: data.config?.configName ?? "—",
        totalScore: data.totalScore,
        grade: data.grade,
        gradeLabel: data.gradeLabel,
        gradeColor: "#22c55e",
        recommendedAction: data.recommendedAction,
        previousScore: data.previousScore,
        scoreChange: data.scoreChange,
        version: data.version,
        factorScores: (data.factorScores as FactorScore[]) ?? [],
        autoAssignRole: data.autoAssignRole ?? null,
        autoNotifyChannels: data.autoNotifyChannels ?? [],
        scoredAt: data.scoredAt,
      });
    } catch (e) {
      setModalOpen(false);
    } finally {
      setModalLoading(false);
      fetchLeaderboard();
      fetchAnalytics();
    }
  };

  const handleViewScore = async (applicationId: string) => {
    setModalOpen(true);
    setModalLoading(true);
    setModalDetail(null);
    try {
      const res = await fetch(
        `${API}/api/v1/lead-scoring/score/${applicationId}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error("No score yet. Click Score first.");
      const data = await res.json();
      setModalDetail({
        applicationId: data.applicationId,
        applicationNumber: data.application?.applicationNumber ?? applicationId,
        customerId: data.customerId,
        customerName: data.customer?.fullName ?? "—",
        configId: data.configId,
        configName: data.config?.configName ?? "—",
        totalScore: data.totalScore,
        grade: data.grade,
        gradeLabel: data.gradeLabel,
        gradeColor: "#22c55e",
        recommendedAction: data.recommendedAction,
        previousScore: data.previousScore,
        scoreChange: data.scoreChange,
        version: data.version,
        factorScores: (data.factorScores as FactorScore[]) ?? [],
        autoAssignRole: null,
        autoNotifyChannels: [],
        scoredAt: data.scoredAt,
      });
    } catch {
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  // Filter leaderboard by search
  const filteredLeaderboard = leaderboard.filter((item) => {
    if (!scoreSearch) return true;
    const q = scoreSearch.toLowerCase();
    return (
      item.applicationNumber.toLowerCase().includes(q) ||
      item.customer.fullName.toLowerCase().includes(q) ||
      item.customer.phone.includes(q)
    );
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-500" />
            Lead Scoring
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Auto-score every lead on quality and conversion probability. Focus
            on the best opportunities.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {bulkResult && (
            <span className="text-sm text-green-600 font-medium">
              {bulkResult}
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleBulkScore}
            disabled={bulkLoading}
          >
            {bulkLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            {bulkLoading ? "Scoring..." : "Bulk Score All"}
          </Button>
        </div>
      </div>

      {/* Top row: Grade distribution + Conversion stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Grade Distribution
            </h2>
          </CardHeader>
          <CardContent>
            <GradeDistributionChart
              distribution={distribution}
              total={distTotal}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Conversion Rate by Grade
            </h2>
            <p className="text-xs text-gray-400">
              % of scored leads that reached Disbursed status
            </p>
          </CardHeader>
          <CardContent>
            {conversion.length > 0 ? (
              <ConversionStats data={conversion} />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <TrendingUp className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No conversion data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-700">
              Lead Leaderboard
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLeaderboard}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mt-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search application or customer..."
                value={scoreSearch}
                onChange={(e) => setScoreSearch(e.target.value)}
                className="pl-8 text-sm h-8"
              />
            </div>

            <div className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-gray-400" />
              {["", "A", "B", "C", "D", "F"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    gradeFilter === g
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {g === "" ? "All" : g}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="mx-4 mb-4 p-3 bg-red-50 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Star className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">No scored leads found.</p>
              <p className="text-xs mt-1">
                Click &quot;Bulk Score All&quot; to score your pipeline.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeaderboard.map((item, idx) => (
                    <TableRow
                      key={item.scoreId}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleViewScore(item.applicationId)}
                    >
                      <TableCell className="text-gray-400 text-xs">
                        {idx + 1}
                      </TableCell>

                      <TableCell>
                        <div>
                          <p className="font-medium text-sm text-blue-600">
                            {item.applicationNumber}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.applicationStatus.replace(/_/g, " ")}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">
                            {item.customer.fullName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.customer.phone}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <LeadScoreChip
                          score={item.totalScore}
                          grade={item.grade}
                          gradeLabel={item.gradeLabel}
                        />
                      </TableCell>

                      <TableCell>
                        <span className="text-sm">
                          {item.product?.name ?? "—"}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm font-medium">
                          {formatAmount(item.requestedAmountRupees)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.sourceType}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {item.assignedTo
                            ? `${item.assignedTo.firstName} ${item.assignedTo.lastName}`
                            : "—"}
                        </span>
                      </TableCell>

                      <TableCell>
                        {item.recommendedAction ? (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              ACTION_COLORS[item.recommendedAction] ??
                              "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {formatAction(item.recommendedAction)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleScore(item.applicationId);
                            }}
                            className="p-1 rounded text-blue-500 hover:bg-blue-50 transition-colors"
                            title="Re-score"
                          >
                            <Zap className="h-3.5 w-3.5" />
                          </button>
                          <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Score breakdown modal */}
      <ScoreBreakdownModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        detail={modalDetail}
        loading={modalLoading}
      />
    </div>
  );
}
