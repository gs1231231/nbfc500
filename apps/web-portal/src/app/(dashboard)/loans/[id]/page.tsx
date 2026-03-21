"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockLoans, mockEmiSchedule } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Loan } from "@/lib/api";

const STATUS_COLORS = {
  ACTIVE: "success",
  CLOSED: "secondary",
  NPA: "destructive",
  WRITTEN_OFF: "outline",
} as const;

const EMI_STATUS_COLORS = {
  PAID: "success",
  PENDING: "secondary",
  OVERDUE: "destructive",
} as const;

export default function LoanDetailPage() {
  const params = useParams();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const found = mockLoans.find((l) => l.id === params.id);
    setLoan(found || null);
    setLoading(false);
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loan not found.</p>
        <Link href="/loans" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          Back to loans
        </Link>
      </div>
    );
  }

  const paidInstallments = mockEmiSchedule.filter((e) => e.status === "PAID").length;
  const totalInstallments = mockEmiSchedule.length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/loans">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{loan.loanNumber}</h1>
            <Badge variant={STATUS_COLORS[loan.status]}>{loan.status}</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{loan.product} • {loan.customerName}</p>
        </div>
      </div>

      {/* Loan summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Principal", value: formatCurrency(loan.principalAmount) },
          { label: "Outstanding", value: formatCurrency(loan.outstandingAmount) },
          { label: "EMI Amount", value: formatCurrency(loan.emiAmount) },
          { label: "DPD", value: loan.dpd.toString(), highlight: loan.dpd > 0 },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</p>
              <p
                className={`text-xl font-bold mt-1 ${
                  item.highlight ? "text-red-600" : "text-gray-900"
                }`}
              >
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loan details + Progress */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                ["Loan Number", loan.loanNumber],
                ["Customer", loan.customerName],
                ["Product", loan.product],
                ["Branch", loan.branch || "—"],
                ["Disbursed On", formatDate(loan.disbursedAt)],
                ["Next Due Date", formatDate(loan.nextDueDate)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-medium text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repayment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Installments Paid</span>
                  <span className="font-semibold text-gray-900">
                    {paidInstallments} / {totalInstallments}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(paidInstallments / totalInstallments) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Principal Repaid</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(loan.principalAmount - loan.outstandingAmount)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{
                      width: `${((loan.principalAmount - loan.outstandingAmount) / loan.principalAmount) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-green-700 font-medium">Paid</p>
                  <p className="text-lg font-bold text-green-800">
                    {formatCurrency(loan.principalAmount - loan.outstandingAmount)}
                  </p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-amber-700 font-medium">Remaining</p>
                  <p className="text-lg font-bold text-amber-800">
                    {formatCurrency(loan.outstandingAmount)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* EMI Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>EMI Schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>EMI Amount</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockEmiSchedule.map((emi) => (
                <TableRow key={emi.installmentNumber}>
                  <TableCell className="text-gray-500">{emi.installmentNumber}</TableCell>
                  <TableCell>{formatDate(emi.dueDate)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(emi.emiAmount)}</TableCell>
                  <TableCell>{formatCurrency(emi.principalAmount)}</TableCell>
                  <TableCell>{formatCurrency(emi.interestAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={EMI_STATUS_COLORS[emi.status]}>{emi.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {emi.paidDate ? formatDate(emi.paidDate) : "—"}
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
