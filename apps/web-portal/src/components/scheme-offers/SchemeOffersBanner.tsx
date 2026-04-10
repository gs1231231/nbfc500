"use client";

import { useState, useEffect } from "react";
import { Tag, Star, TrendingDown, Percent, Gift, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────

interface EligibleScheme {
  id: string;
  schemeCode: string;
  schemeName: string;
  schemeType: string;
  description?: string | null;
  interestRateDiscountBps?: number | null;
  fixedInterestRateBps?: number | null;
  processingFeeWaiver?: boolean;
  processingFeeDiscountPercent?: number | null;
  cashbackAmountPaisa?: number | null;
  cashbackCondition?: string | null;
  validFrom: string;
  validTo: string;
  budgetRemaining?: number | null;
}

interface SegmentMatch {
  segmentId: string;
  segmentCode: string;
  segmentName: string;
  segmentType: string;
  priority: number;
  score: number;
}

interface OffersResponse {
  applicationId: string;
  customerId: string;
  segments: SegmentMatch[];
  eligibleSchemes: EligibleScheme[];
  recommendedScheme: {
    id: string;
    schemeCode: string;
    schemeName: string;
    schemeType: string;
  } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function formatBenefit(scheme: EligibleScheme): string {
  const parts: string[] = [];

  if (scheme.interestRateDiscountBps) {
    parts.push(`${(scheme.interestRateDiscountBps / 100).toFixed(2)}% rate discount`);
  }
  if (scheme.fixedInterestRateBps) {
    parts.push(`Fixed ${(scheme.fixedInterestRateBps / 100).toFixed(2)}% interest`);
  }
  if (scheme.processingFeeWaiver) {
    parts.push("Zero processing fee");
  } else if (scheme.processingFeeDiscountPercent) {
    parts.push(`${scheme.processingFeeDiscountPercent}% PF discount`);
  }
  if (scheme.cashbackAmountPaisa) {
    parts.push(`₹${(scheme.cashbackAmountPaisa / 100).toLocaleString("en-IN")} cashback`);
  }

  return parts.length > 0 ? parts.join(" • ") : "Special offer";
}

const SCHEME_TYPE_ICON: Record<string, React.ReactNode> = {
  FESTIVE: <Gift className="h-4 w-4 text-orange-500" />,
  PROMOTIONAL: <Percent className="h-4 w-4 text-blue-500" />,
  BALANCE_TRANSFER: <TrendingDown className="h-4 w-4 text-green-500" />,
  CORPORATE_TIE_UP: <Tag className="h-4 w-4 text-purple-500" />,
  LOYALTY: <Star className="h-4 w-4 text-yellow-500" />,
};

// ── Scheme Card ───────────────────────────────────────────────────────────────

function SchemeCard({
  scheme,
  isRecommended,
  onApply,
}: {
  scheme: EligibleScheme;
  isRecommended: boolean;
  onApply: (scheme: EligibleScheme) => void;
}) {
  return (
    <div
      className={`relative rounded-xl border p-4 transition-all ${
        isRecommended
          ? "border-blue-400 bg-blue-50 shadow-sm ring-1 ring-blue-300"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      {isRecommended && (
        <div className="absolute -top-2.5 left-4">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-semibold shadow">
            <Star className="h-3 w-3" />
            Recommended
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {SCHEME_TYPE_ICON[scheme.schemeType] ?? <Tag className="h-4 w-4 text-gray-400" />}
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {scheme.schemeName}
            </h4>
            <p className="text-xs text-gray-500 font-mono">{scheme.schemeCode}</p>
          </div>
        </div>
        <Badge className="text-xs bg-gray-100 text-gray-600 flex-shrink-0">
          {scheme.schemeType.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Benefits */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {scheme.interestRateDiscountBps && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
            <TrendingDown className="h-3 w-3" />
            {(scheme.interestRateDiscountBps / 100).toFixed(2)}% off rate
          </span>
        )}
        {scheme.fixedInterestRateBps && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
            <Percent className="h-3 w-3" />
            Fixed {(scheme.fixedInterestRateBps / 100).toFixed(2)}%
          </span>
        )}
        {scheme.processingFeeWaiver && (
          <span className="inline-flex text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">
            Zero PF
          </span>
        )}
        {scheme.processingFeeDiscountPercent && !scheme.processingFeeWaiver && (
          <span className="inline-flex text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">
            {String(scheme.processingFeeDiscountPercent)}% PF off
          </span>
        )}
        {scheme.cashbackAmountPaisa && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
            <Gift className="h-3 w-3" />
            ₹{(scheme.cashbackAmountPaisa / 100).toLocaleString("en-IN")} cashback
          </span>
        )}
      </div>

      {scheme.description && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-1">{scheme.description}</p>
      )}

      {scheme.budgetRemaining !== null && scheme.budgetRemaining !== undefined && (
        <p className="text-xs text-amber-600 mt-1.5">
          {scheme.budgetRemaining} slots remaining
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Valid till{" "}
          {new Date(scheme.validTo).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <button
          onClick={() => onApply(scheme)}
          className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            isRecommended
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-900 text-white hover:bg-gray-700"
          }`}
        >
          Apply Scheme
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface SchemeOffersBannerProps {
  applicationId: string;
  onSchemeApplied?: (schemeId: string, schemeName: string) => void;
}

export function SchemeOffersBanner({
  applicationId,
  onSchemeApplied,
}: SchemeOffersBannerProps) {
  const [data, setData] = useState<OffersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  useEffect(() => {
    if (!applicationId) return;
    setLoading(true);
    setError(null);

    fetch(`${API}/api/v1/segmentation/offers/${applicationId}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load offers");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [applicationId]);

  const handleApply = async (scheme: EligibleScheme) => {
    setApplying(scheme.id);
    try {
      const res = await fetch(
        `${API}/api/v1/schemes/apply/${applicationId}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ schemeId: scheme.id }),
        },
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message ?? "Failed to apply scheme");
      }
      setAppliedId(scheme.id);
      onSchemeApplied?.(scheme.id, scheme.schemeName);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to apply scheme");
    } finally {
      setApplying(null);
    }
  };

  // Don't render if dismissed or loading failed without data
  if (dismissed) return null;
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-48 mb-3" />
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    );
  }
  if (error || !data) return null;
  if (data.eligibleSchemes.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center">
              <Star className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Recommended for this customer
            </h3>
            <p className="text-xs text-gray-500">
              {data.segments.length > 0 && (
                <>
                  Matched segments:{" "}
                  {data.segments
                    .slice(0, 2)
                    .map((s) => s.segmentName)
                    .join(", ")}
                  {data.segments.length > 2 && ` +${data.segments.length - 2} more`}
                </>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Schemes */}
      <div className="p-4">
        {appliedId && (
          <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
            Scheme applied successfully!
          </div>
        )}

        <div
          className={`grid gap-3 ${
            data.eligibleSchemes.length === 1
              ? "grid-cols-1"
              : data.eligibleSchemes.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {data.eligibleSchemes.map((scheme) => (
            <div key={scheme.id} className={applying === scheme.id ? "opacity-60 pointer-events-none" : ""}>
              <SchemeCard
                scheme={scheme}
                isRecommended={scheme.id === data.recommendedScheme?.id && !appliedId}
                onApply={handleApply}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
