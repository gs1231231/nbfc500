"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PhoneCall, AlertTriangle, TrendingUp, CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockCollectionDashboard, mockCollectionTasks } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";

const TASK_STATUS_COLORS = {
  PENDING: "warning",
  CONTACTED: "default",
  PTP: "secondary",
  RESOLVED: "success",
} as const;

const BAR_COLORS = ["#3b82f6", "#f59e0b", "#f97316", "#ef4444", "#dc2626", "#991b1b"];

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-gray-900">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm text-gray-600">
            {p.name === "count" ? `${p.value} loans` : formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function CollectionsPage() {
  const [dashboard] = useState(mockCollectionDashboard);
  const [tasks] = useState(mockCollectionTasks);
  const [activeTab, setActiveTab] = useState<"count" | "amount">("count");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Collections Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor overdue loans and collection activities</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Total Overdue",
            value: formatCurrency(dashboard.totalOverdue),
            icon: AlertTriangle,
            color: "bg-red-500",
          },
          {
            title: "Today's Tasks",
            value: dashboard.todayTasks,
            icon: CheckSquare,
            color: "bg-blue-500",
          },
          {
            title: "Collection Efficiency",
            value: `${dashboard.efficiency}%`,
            icon: TrendingUp,
            color: "bg-green-500",
          },
          {
            title: "NPA Accounts",
            value: dashboard.dpdBuckets
              .filter((b) => b.bucket.includes("91") || b.bucket.includes("180"))
              .reduce((sum, b) => sum + b.count, 0),
            icon: PhoneCall,
            color: "bg-amber-500",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{item.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{item.value}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${item.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* DPD Bucket Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>DPD Bucket Analysis</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={activeTab === "count" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("count")}
              >
                By Count
              </Button>
              <Button
                variant={activeTab === "amount" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("amount")}
              >
                By Amount
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dashboard.dpdBuckets}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={
                    activeTab === "amount"
                      ? (v) => `₹${(v / 100000).toFixed(0)}L`
                      : undefined
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey={activeTab}
                  name={activeTab}
                  radius={[4, 4, 0, 0]}
                >
                  {dashboard.dpdBuckets.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {dashboard.dpdBuckets.map((bucket, idx) => (
              <div key={bucket.bucket} className="text-center">
                <div
                  className="h-2 rounded-full mb-1"
                  style={{ backgroundColor: BAR_COLORS[idx] }}
                />
                <p className="text-xs font-medium text-gray-700">{bucket.bucket}</p>
                <p className="text-xs text-gray-500">{bucket.count} loans</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Today's Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Collection Tasks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>DPD</TableHead>
                <TableHead>Overdue Amount</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-mono text-xs">{task.loanNumber}</TableCell>
                  <TableCell className="font-medium text-gray-900">{task.customerName}</TableCell>
                  <TableCell>{task.mobile}</TableCell>
                  <TableCell>
                    <span
                      className={`font-bold ${
                        task.dpd > 90
                          ? "text-red-600"
                          : task.dpd > 30
                          ? "text-amber-600"
                          : "text-orange-500"
                      }`}
                    >
                      {task.dpd}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-red-600">
                    {formatCurrency(task.overdueAmount)}
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">
                    {task.assignedAgent || "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TASK_STATUS_COLORS[task.status]}>{task.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDate(task.scheduledDate)}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      <PhoneCall className="h-3.5 w-3.5 mr-1" />
                      Call
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
