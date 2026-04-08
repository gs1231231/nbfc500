"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  LayoutDashboard,
  Users,
  CreditCard,
  PhoneCall,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockApplications, mockCollectionDashboard } from "@/lib/mock-data";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Application, CollectionDashboard } from "@/lib/api";

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  DRAFT: "secondary",
  SUBMITTED: "default",
  UNDER_REVIEW: "default",
  BUREAU_CHECK: "warning",
  BRE_CHECK: "warning",
  CREDIT_REVIEW: "warning",
  SANCTIONED: "success",
  DOCUMENTATION: "warning",
  DISBURSED: "success",
  REJECTED: "destructive",
  WITHDRAWN: "secondary",
  LEAD: "secondary",
  APPLICATION: "default",
  DOCUMENT_COLLECTION: "warning",
  UNDERWRITING: "warning",
  APPROVED: "success",
  DISBURSEMENT_PENDING: "warning",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  BUREAU_CHECK: "Bureau Check",
  BRE_CHECK: "BRE Check",
  CREDIT_REVIEW: "Credit Review",
  SANCTIONED: "Sanctioned",
  DOCUMENTATION: "Documentation",
  DISBURSED: "Disbursed",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  LEAD: "Lead",
  APPLICATION: "Application",
  DOCUMENT_COLLECTION: "Docs Collection",
  UNDERWRITING: "Underwriting",
  APPROVED: "Approved",
  DISBURSEMENT_PENDING: "Disbursal Pending",
};

interface DashboardStats {
  todayApplications: number;
  sanctionedToday: number;
  disbursedToday: number;
  pendingApproval: number;
  sanctionedAmountToday?: number;
  disbursedAmountToday?: number;
  recentApplications?: Application[];
}

/** Map user role to quick-link sections. */
function getRoleLinks(role: string | null | undefined) {
  const allLinks = [
    { href: "/applications", label: "Applications", icon: FileText, color: "bg-blue-500" },
    { href: "/customers", label: "Customers", icon: Users, color: "bg-purple-500" },
    { href: "/loans", label: "Loans", icon: CreditCard, color: "bg-green-500" },
    { href: "/collections", label: "Collections", icon: PhoneCall, color: "bg-amber-500" },
  ];

  switch (role) {
    case "COLLECTION_AGENT":
      return allLinks.filter((l) => l.href === "/collections" || l.href === "/loans");
    case "ACCOUNTS_OFFICER":
      return allLinks.filter((l) => l.href === "/loans" || l.href === "/customers");
    default:
      return allLinks;
  }
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  color: string;
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, color }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                {trend.positive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${trend.positive ? "text-green-600" : "text-red-600"}`}
                >
                  {trend.value}% vs yesterday
                </span>
              </div>
            )}
          </div>
          <div className={`rounded-xl p-3 ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [dpdBuckets, setDpdBuckets] = useState(mockCollectionDashboard.dpdBuckets);
  const [collectionSummary, setCollectionSummary] = useState<Pick<CollectionDashboard, "totalOverdue" | "efficiency">>({
    totalOverdue: mockCollectionDashboard.totalOverdue,
    efficiency: mockCollectionDashboard.efficiency,
  });
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [userName, setUserName] = useState("there");
  const [roleLinks, setRoleLinks] = useState(getRoleLinks(null));

  useEffect(() => {
    // Read user info from localStorage for personalisation and role-based links
    try {
      const userJson = localStorage.getItem("user");
      if (userJson) {
        const user = JSON.parse(userJson) as { firstName?: string; role?: string };
        if (user.firstName) setUserName(user.firstName);
        setRoleLinks(getRoleLinks(user.role));
      }
    } catch {
      // Ignore
    }

    async function fetchDashboard() {
      let usedMock = false;

      // 1. Fetch dashboard stats
      try {
        const data = await api.get<DashboardStats>("/dashboard/stats");
        setStats(data);
        if (data.recentApplications?.length) {
          setApplications(data.recentApplications);
        }
      } catch {
        // Build rough stats from mock applications
        const pending = mockApplications.filter(
          (a) => a.status === "UNDER_REVIEW" || a.status === "CREDIT_REVIEW" || a.status === "UNDERWRITING"
        ).length;
        setStats({
          todayApplications: 12,
          sanctionedToday: 3,
          disbursedToday: 2,
          pendingApproval: pending,
          sanctionedAmountToday: 1500000,
          disbursedAmountToday: 700000,
        });
        setApplications(mockApplications.slice(0, 10));
        usedMock = true;
      }

      // 2. Fetch NPA / collections summary
      try {
        const npa = await api.get<{ dpdBuckets?: CollectionDashboard["dpdBuckets"] }>("/dashboard/npa-summary");
        if (npa.dpdBuckets?.length) setDpdBuckets(npa.dpdBuckets);
      } catch {
        // keep mock DPD buckets
        usedMock = true;
      }

      try {
        const col = await api.get<CollectionDashboard>("/collections/dashboard");
        setCollectionSummary({ totalOverdue: col.totalOverdue, efficiency: col.efficiency });
      } catch {
        // keep mock collection summary
        usedMock = true;
      }

      setIsDemo(usedMock);
      setLoading(false);
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">Loading dashboard...</span>
      </div>
    );
  }

  const pendingApproval =
    stats?.pendingApproval ??
    applications.filter(
      (a) => a.status === "UNDER_REVIEW" || a.status === "CREDIT_REVIEW" || a.status === "UNDERWRITING"
    ).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            {isDemo && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium border border-amber-200">
                Demo data
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, {userName}. Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <LayoutDashboard className="h-3.5 w-3.5" />
          <span>Overview</span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Today's Applications"
          value={stats?.todayApplications ?? 0}
          subtitle="New applications received"
          icon={FileText}
          trend={{ value: 20, positive: true }}
          color="bg-blue-500"
        />
        <MetricCard
          title="Sanctioned Today"
          value={stats?.sanctionedToday ?? 0}
          subtitle={stats?.sanctionedAmountToday ? formatCurrency(stats.sanctionedAmountToday) + " total" : undefined}
          icon={CheckCircle}
          trend={{ value: 5, positive: true }}
          color="bg-green-500"
        />
        <MetricCard
          title="Disbursed Today"
          value={stats?.disbursedToday ?? 0}
          subtitle={stats?.disbursedAmountToday ? formatCurrency(stats.disbursedAmountToday) + " total" : undefined}
          icon={DollarSign}
          trend={{ value: 10, positive: false }}
          color="bg-purple-500"
        />
        <MetricCard
          title="Pending Approval"
          value={pendingApproval}
          subtitle="Requires review"
          icon={Clock}
          color="bg-amber-500"
        />
      </div>

      {/* Recent Applications + DPD Summary */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent Applications */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Recent Applications</CardTitle>
              <Link
                href="/applications"
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {applications.length === 0 ? (
                <div className="text-center text-gray-400 py-12 text-sm">No recent applications</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <Link
                            href={`/applications/${app.id}`}
                            className="font-mono text-xs text-blue-600 hover:underline"
                          >
                            {app.applicationNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium text-gray-900">
                          {app.applicantName}
                        </TableCell>
                        <TableCell className="text-gray-600">{app.product}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(app.loanAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_COLORS[app.status] ?? "secondary"}>
                            {STATUS_LABELS[app.status] ?? app.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500 text-xs">
                          {formatDate(app.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: DPD summary + Quick Links */}
        <div className="space-y-6">
          {/* DPD Bucket Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Overdue Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dpdBuckets.map((bucket) => {
                const maxCount = Math.max(...dpdBuckets.map((b) => b.count));
                const pct = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                const isHighRisk = bucket.bucket.includes("91") || bucket.bucket.includes("180");

                return (
                  <div key={bucket.bucket}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{bucket.bucket}</span>
                      <div className="text-right">
                        <span className="text-gray-900 font-semibold">{bucket.count}</span>
                        <span className="text-gray-400 text-xs ml-1">loans</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isHighRisk ? "bg-red-500" : "bg-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-20 text-right">
                        {formatCurrency(bucket.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Overdue</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(collectionSummary.totalOverdue)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Collection Efficiency</span>
                  <span className="font-bold text-green-600">
                    {collectionSummary.efficiency}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role-based quick links */}
          {roleLinks.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {roleLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.href} href={link.href}>
                      <div className="flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all">
                        <div className={`rounded-lg p-2 ${link.color}`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{link.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
