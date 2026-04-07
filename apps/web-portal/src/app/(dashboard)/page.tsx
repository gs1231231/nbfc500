"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  CheckCircle,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockApplications, mockCollectionDashboard } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Application } from "@/lib/api";

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
};

/** Map user role to default landing page. */
function getDefaultRoute(role: string | null | undefined): string {
  switch (role) {
    case "SUPER_ADMIN":
    case "BRANCH_MANAGER":
    case "CREDIT_OFFICER":
      return "/applications";
    case "COLLECTION_AGENT":
      return "/collections";
    case "ACCOUNTS_OFFICER":
      return "/loans";
    default:
      return "/applications";
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
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const dpdBuckets = mockCollectionDashboard.dpdBuckets;

  // Role-based redirect on mount
  useEffect(() => {
    try {
      const userJson = localStorage.getItem("user");
      if (userJson) {
        const user = JSON.parse(userJson) as { role?: string };
        const route = getDefaultRoute(user?.role);
        router.replace(route);
        return;
      }
    } catch {
      // localStorage not available or invalid JSON — fall through to default dashboard
    }
    setApplications(mockApplications.slice(0, 10));
  }, [router]);

  const todayApps = 12;
  const sanctionedToday = 3;
  const disbursedToday = 2;
  const pendingApproval = applications.filter(
    (a) => a.status === "UNDER_REVIEW" || a.status === "CREDIT_REVIEW"
  ).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, Priya. Here&apos;s what&apos;s happening today.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Today's Applications"
          value={todayApps}
          subtitle="New applications received"
          icon={FileText}
          trend={{ value: 20, positive: true }}
          color="bg-blue-500"
        />
        <MetricCard
          title="Sanctioned Today"
          value={sanctionedToday}
          subtitle={formatCurrency(1500000) + " total"}
          icon={CheckCircle}
          trend={{ value: 5, positive: true }}
          color="bg-green-500"
        />
        <MetricCard
          title="Disbursed Today"
          value={disbursedToday}
          subtitle={formatCurrency(700000) + " total"}
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
                        <Badge variant={STATUS_COLORS[app.status]}>
                          {STATUS_LABELS[app.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500 text-xs">
                        {formatDate(app.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* DPD Bucket Summary */}
        <div>
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
                const pct = (bucket.count / maxCount) * 100;
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
                    {formatCurrency(mockCollectionDashboard.totalOverdue)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Collection Efficiency</span>
                  <span className="font-bold text-green-600">
                    {mockCollectionDashboard.efficiency}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
