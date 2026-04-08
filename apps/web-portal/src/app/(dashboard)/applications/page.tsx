"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, User, DollarSign, Building, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mockApplications } from "@/lib/mock-data";
import { applicationsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Application } from "@/lib/api";

// Kanban statuses aligned with real API status values
const KANBAN_COLUMNS: { status: string; label: string; color: string; bg: string }[] = [
  { status: "LEAD", label: "Lead", color: "text-slate-700", bg: "bg-slate-50" },
  { status: "APPLICATION", label: "Application", color: "text-blue-700", bg: "bg-blue-50" },
  { status: "DOCUMENT_COLLECTION", label: "Docs Collection", color: "text-indigo-700", bg: "bg-indigo-50" },
  { status: "BUREAU_CHECK", label: "Bureau Check", color: "text-purple-700", bg: "bg-purple-50" },
  { status: "UNDERWRITING", label: "Underwriting", color: "text-amber-700", bg: "bg-amber-50" },
  { status: "APPROVED", label: "Approved", color: "text-teal-700", bg: "bg-teal-50" },
  { status: "SANCTIONED", label: "Sanctioned", color: "text-green-700", bg: "bg-green-50" },
  { status: "DISBURSEMENT_PENDING", label: "Disbursal Pending", color: "text-orange-700", bg: "bg-orange-50" },
  { status: "DISBURSED", label: "Disbursed", color: "text-emerald-700", bg: "bg-emerald-50" },
  { status: "REJECTED", label: "Rejected", color: "text-red-700", bg: "bg-red-50" },
  // Legacy statuses kept so mock-data still renders correctly
  { status: "SUBMITTED", label: "Submitted", color: "text-blue-700", bg: "bg-blue-50" },
  { status: "UNDER_REVIEW", label: "Under Review", color: "text-amber-700", bg: "bg-amber-50" },
  { status: "CREDIT_REVIEW", label: "Credit Review", color: "text-orange-700", bg: "bg-orange-50" },
  { status: "DOCUMENTATION", label: "Documentation", color: "text-teal-700", bg: "bg-teal-50" },
  { status: "BRE_CHECK", label: "BRE Check", color: "text-indigo-700", bg: "bg-indigo-50" },
];

const PRODUCT_COLORS: Record<string, string> = {
  "Personal Loan": "bg-blue-100 text-blue-700",
  "Business Loan": "bg-purple-100 text-purple-700",
  "Home Loan": "bg-green-100 text-green-700",
  "Gold Loan": "bg-amber-100 text-amber-700",
  "Two-Wheeler Loan": "bg-teal-100 text-teal-700",
};

function KanbanCard({ app }: { app: Application }) {
  return (
    <Link href={`/applications/${app.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="font-mono text-xs text-gray-400">{app.applicationNumber}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRODUCT_COLORS[app.product] || "bg-gray-100 text-gray-700"}`}
          >
            {app.product}
          </span>
        </div>

        {/* Applicant */}
        <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
          {app.applicantName}
        </p>

        {/* Amount */}
        <div className="flex items-center gap-1.5 mt-2">
          <DollarSign className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            {formatCurrency(app.loanAmount)}
          </span>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          {app.dsaName ? (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Building className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{app.dsaName}</span>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {app.assignedOfficer && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[60px]">{app.assignedOfficer.split(" ")[0]}</span>
              </div>
            )}
            {app.daysInStage !== undefined && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                <span>{app.daysInStage}d</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [filterProduct, setFilterProduct] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    async function fetchApplications() {
      try {
        const result = await applicationsApi.list();
        setApplications(result.data || []);
        setIsDemo(false);
      } catch {
        // Fallback to mock data when API is unavailable
        setApplications(mockApplications);
        setIsDemo(true);
      } finally {
        setLoading(false);
      }
    }
    fetchApplications();
  }, []);

  const filteredApps = filterProduct === "ALL"
    ? applications
    : applications.filter((a) => a.product === filterProduct);

  const products = ["ALL", ...Array.from(new Set(applications.map((a) => a.product)))];

  // Only show columns that have at least one application OR are primary real-data columns
  const primaryStatuses = new Set([
    "LEAD", "APPLICATION", "DOCUMENT_COLLECTION", "BUREAU_CHECK",
    "UNDERWRITING", "APPROVED", "SANCTIONED", "DISBURSEMENT_PENDING", "DISBURSED", "REJECTED",
  ]);
  const appStatuses = new Set<string>(applications.map((a) => a.status));
  const visibleColumns = KANBAN_COLUMNS.filter(
    (col) => primaryStatuses.has(col.status as string) || appStatuses.has(col.status as string)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">Loading applications...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Application Pipeline</h1>
            {isDemo && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium border border-amber-200">
                Demo data
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {applications.length} total applications
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {products.map((p) => (
            <button
              key={p}
              onClick={() => setFilterProduct(p)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterProduct === p
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {visibleColumns.map((col) => {
            const colApps = filteredApps.filter((a) => a.status === col.status);
            return (
              <div key={col.status} className="w-64 flex-shrink-0">
                {/* Column header */}
                <div className={`rounded-t-lg px-4 py-3 ${col.bg} border border-gray-200 border-b-0`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {colApps.length}
                    </Badge>
                  </div>
                </div>

                {/* Column cards */}
                <div className="rounded-b-lg border border-gray-200 border-t-0 bg-gray-50 p-2 min-h-[400px] space-y-2">
                  {colApps.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs text-gray-400">
                      No applications
                    </div>
                  ) : (
                    colApps.map((app) => <KanbanCard key={app.id} app={app} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
