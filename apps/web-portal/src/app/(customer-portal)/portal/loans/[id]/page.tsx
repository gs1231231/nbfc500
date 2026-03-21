"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  IndianRupee,
  Calendar,
} from "lucide-react";

// Mock loan detail with full schedule
const MOCK_LOAN_DETAIL = {
  "loan-001": {
    id: "loan-001",
    loanNumber: "LN/2024/000123",
    productType: "Personal Loan",
    disbursedAmountPaisa: 50000000,
    outstandingPrincipalPaisa: 35000000,
    emiAmountPaisa: 1050000,
    interestRateBps: 1600, // 16% p.a.
    tenureMonths: 60,
    disbursementDate: "2024-10-05",
    maturityDate: "2029-10-05",
    nextEmiDate: "2026-04-05",
    dpd: 0,
    loanStatus: "ACTIVE",
    schedule: Array.from({ length: 60 }, (_, i) => ({
      installmentNumber: i + 1,
      dueDate: new Date(2024, 9 + i, 5).toISOString().split("T")[0],
      emiAmountPaisa: 1050000,
      principalComponentPaisa: 630000 + i * 3000,
      interestComponentPaisa: 420000 - i * 3000,
      status: i < 18 ? "PAID" : i === 18 ? "OVERDUE" : "PENDING",
      paidAmountPaisa: i < 18 ? 1050000 : 0,
      paidDate: i < 18 ? new Date(2024, 9 + i, 5).toISOString().split("T")[0] : null,
    })),
  },
  "loan-002": {
    id: "loan-002",
    loanNumber: "LN/2023/000456",
    productType: "Business Loan",
    disbursedAmountPaisa: 150000000,
    outstandingPrincipalPaisa: 85000000,
    emiAmountPaisa: 3250000,
    interestRateBps: 1400,
    tenureMonths: 48,
    disbursementDate: "2024-02-10",
    maturityDate: "2028-02-10",
    nextEmiDate: "2026-04-10",
    dpd: 3,
    loanStatus: "ACTIVE",
    schedule: Array.from({ length: 48 }, (_, i) => ({
      installmentNumber: i + 1,
      dueDate: new Date(2024, 1 + i, 10).toISOString().split("T")[0],
      emiAmountPaisa: 3250000,
      principalComponentPaisa: 2100000 + i * 10000,
      interestComponentPaisa: 1150000 - i * 10000,
      status: i < 14 ? "PAID" : i === 14 ? "OVERDUE" : "PENDING",
      paidAmountPaisa: i < 14 ? 3250000 : 0,
      paidDate: i < 14 ? new Date(2024, 1 + i, 10).toISOString().split("T")[0] : null,
    })),
  },
};

function formatCurrency(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString("en-IN")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  PAID: {
    bg: "bg-green-100",
    text: "text-green-700",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  PENDING: {
    bg: "bg-gray-100",
    text: "text-gray-600",
    icon: <Clock className="h-3 w-3" />,
  },
  OVERDUE: {
    bg: "bg-red-100",
    text: "text-red-700",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  PARTIALLY_PAID: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

export default function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const loan = MOCK_LOAN_DETAIL[id as keyof typeof MOCK_LOAN_DETAIL];

  if (!loan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Loan not found</h2>
          <Link href="/portal/dashboard" className="text-blue-600 text-sm hover:underline mt-2 block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const paidEmis = loan.schedule.filter((s) => s.status === "PAID").length;
  const overdueEmis = loan.schedule.filter((s) => s.status === "OVERDUE").length;
  const ratePercent = loan.interestRateBps / 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-4 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/portal/dashboard">
            <ArrowLeft className="h-5 w-5 text-white" />
          </Link>
          <div>
            <h1 className="text-base font-bold">Loan Details</h1>
            <p className="text-blue-200 text-xs">{loan.loanNumber}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-8">
        {/* Loan Summary Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-blue-200">{loan.productType}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                loan.dpd === 0 ? "bg-green-400/30 text-green-100" : "bg-red-400/30 text-red-100"
              }`}
            >
              {loan.dpd === 0 ? "Regular" : `DPD ${loan.dpd}`}
            </span>
          </div>
          <p className="text-3xl font-bold mb-1">
            {formatCurrency(loan.outstandingPrincipalPaisa)}
          </p>
          <p className="text-blue-200 text-sm">Outstanding Balance</p>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-blue-200 text-xs">EMI</p>
              <p className="text-sm font-semibold">{formatCurrency(loan.emiAmountPaisa)}</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">Rate</p>
              <p className="text-sm font-semibold">{ratePercent}% p.a.</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">Tenure</p>
              <p className="text-sm font-semibold">{loan.tenureMonths} months</p>
            </div>
          </div>
        </div>

        {/* Key Dates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" /> Key Dates
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Disbursed</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(loan.disbursementDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Next EMI</p>
              <p className="text-sm font-medium text-blue-700">{formatDate(loan.nextEmiDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Maturity</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(loan.maturityDate)}</p>
            </div>
          </div>
        </div>

        {/* EMI Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
            <p className="text-xl font-bold text-green-700">{paidEmis}</p>
            <p className="text-xs text-green-600 mt-0.5">Paid</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
            <p className="text-xl font-bold text-red-700">{overdueEmis}</p>
            <p className="text-xs text-red-600 mt-0.5">Overdue</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
            <p className="text-xl font-bold text-gray-700">
              {loan.tenureMonths - paidEmis - overdueEmis}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Remaining</p>
          </div>
        </div>

        {/* Pay Now */}
        <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors">
          <IndianRupee className="h-4 w-4" />
          Pay EMI — {formatCurrency(loan.emiAmountPaisa)}
        </button>

        {/* Repayment Schedule */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Repayment Schedule</h3>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
              <span>#</span>
              <span>Due Date</span>
              <span className="text-right">EMI</span>
              <span className="text-right">Status</span>
            </div>
            {/* Rows — show first 6 paid, all overdue, and next 3 upcoming */}
            {[
              ...loan.schedule.filter((s) => s.status === "PAID").slice(-3),
              ...loan.schedule.filter((s) => s.status === "OVERDUE"),
              ...loan.schedule.filter((s) => s.status === "PENDING").slice(0, 5),
            ].map((row) => {
              const style = STATUS_STYLE[row.status] ?? STATUS_STYLE.PENDING;
              return (
                <div
                  key={row.installmentNumber}
                  className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-gray-50 last:border-0 text-sm items-center"
                >
                  <span className="text-gray-400 text-xs">{row.installmentNumber}</span>
                  <span className="text-gray-700 text-xs">{formatDate(row.dueDate)}</span>
                  <span className="text-right text-gray-900 text-xs font-medium">
                    {formatCurrency(row.emiAmountPaisa)}
                  </span>
                  <div className="flex justify-end">
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}
                    >
                      {style.icon}
                      {row.status === "PARTIALLY_PAID" ? "Partial" : row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="px-4 py-3 bg-gray-50 text-xs text-gray-500 text-center">
              Showing recent & upcoming installments · {loan.tenureMonths} total
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
