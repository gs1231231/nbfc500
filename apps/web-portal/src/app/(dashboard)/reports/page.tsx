"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { TrendingUp, Users, DollarSign, AlertTriangle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mockPortfolioSummary } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#14b8a6"];

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-gray-900 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm" style={{ color: p.color }}>
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ReportsPage() {
  const summary = mockPortfolioSummary;
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const metrics = [
    {
      title: "Total AUM",
      value: formatCurrency(summary.totalAUM),
      icon: DollarSign,
      color: "bg-blue-500",
      detail: "Portfolio under management",
    },
    {
      title: "Total Customers",
      value: summary.totalCustomers.toLocaleString("en-IN"),
      icon: Users,
      color: "bg-purple-500",
      detail: `${summary.activeLoans} active loans`,
    },
    {
      title: "NPA %",
      value: `${summary.npaPercentage}%`,
      icon: AlertTriangle,
      color: "bg-red-500",
      detail: "Non-performing assets",
    },
    {
      title: "Collection Efficiency",
      value: `${summary.collectionEfficiency}%`,
      icon: TrendingUp,
      color: "bg-green-500",
      detail: `₹${(summary.disbursedThisMonth / 100000).toFixed(1)}L disbursed this month`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Portfolio overview and performance metrics</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.title}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{m.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{m.value}</p>
                    <p className="text-xs text-gray-400 mt-1">{m.detail}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${m.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Monthly Trend — Disbursements vs Collections</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={chartType === "bar" ? "default" : "outline"}
                size="sm"
                onClick={() => setChartType("bar")}
              >
                Bar
              </Button>
              <Button
                variant={chartType === "line" ? "default" : "outline"}
                size="sm"
                onClick={() => setChartType("line")}
              >
                Line
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" ? (
                <BarChart
                  data={summary.monthlyTrend}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="disbursed" name="Disbursed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collected" name="Collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart
                  data={summary.monthlyTrend}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="disbursed"
                    name="Disbursed"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="collected"
                    name="Collected"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Product Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.productBreakdown}
                    dataKey="amount"
                    nameKey="product"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {summary.productBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), "Amount"]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Product breakdown table */}
        <Card>
          <CardHeader>
            <CardTitle>Product-wise AUM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.productBreakdown.map((item, idx) => {
                const pct = (item.amount / summary.totalAUM) * 100;
                return (
                  <div key={item.product}>
                    <div className="flex justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[idx] }}
                        />
                        <span className="font-medium text-gray-700">{item.product}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(item.amount)}
                        </span>
                        <span className="text-gray-400 ml-2 text-xs">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: PIE_COLORS[idx],
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 mt-3 border-t border-gray-100 flex justify-between">
                <span className="font-semibold text-gray-700">Total AUM</span>
                <span className="font-bold text-gray-900">{formatCurrency(summary.totalAUM)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key metrics table */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Health Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Total AUM", value: formatCurrency(summary.totalAUM), good: true },
              { label: "Active Loans", value: summary.activeLoans.toLocaleString(), good: true },
              { label: "Total Customers", value: summary.totalCustomers.toLocaleString(), good: true },
              { label: "NPA %", value: `${summary.npaPercentage}%`, good: summary.npaPercentage < 5 },
              { label: "Collection Eff.", value: `${summary.collectionEfficiency}%`, good: summary.collectionEfficiency > 85 },
              { label: "Disbursed (MTD)", value: formatCurrency(summary.disbursedThisMonth), good: true },
            ].map((m) => (
              <div
                key={m.label}
                className={`rounded-lg p-4 text-center ${m.good ? "bg-green-50" : "bg-red-50"}`}
              >
                <p className="text-xs text-gray-500 uppercase tracking-wide">{m.label}</p>
                <p className={`text-lg font-bold mt-1 ${m.good ? "text-green-700" : "text-red-700"}`}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
