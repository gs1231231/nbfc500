"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  RefreshCw,
} from "lucide-react";

// Mock payment history
const MOCK_PAYMENTS = [
  {
    id: "pay-001",
    paymentNumber: "PAY/2026/000342",
    loanNumber: "LN/2024/000123",
    productType: "Personal Loan",
    amountPaisa: 1050000,
    paymentDate: "2026-03-05",
    paymentMode: "UPI",
    referenceNumber: "UPI26030512345",
    status: "SUCCESS",
    allocatedToPrincipalPaisa: 630000,
    allocatedToInterestPaisa: 420000,
  },
  {
    id: "pay-002",
    paymentNumber: "PAY/2026/000218",
    loanNumber: "LN/2023/000456",
    productType: "Business Loan",
    amountPaisa: 3250000,
    paymentDate: "2026-03-10",
    paymentMode: "NEFT",
    referenceNumber: "NEFT2603101234",
    status: "SUCCESS",
    allocatedToPrincipalPaisa: 2100000,
    allocatedToInterestPaisa: 1150000,
  },
  {
    id: "pay-003",
    paymentNumber: "PAY/2026/000115",
    loanNumber: "LN/2024/000123",
    productType: "Personal Loan",
    amountPaisa: 1050000,
    paymentDate: "2026-02-05",
    paymentMode: "NACH",
    referenceNumber: "NACH260205678",
    status: "SUCCESS",
    allocatedToPrincipalPaisa: 627000,
    allocatedToInterestPaisa: 423000,
  },
  {
    id: "pay-004",
    paymentNumber: "PAY/2026/000098",
    loanNumber: "LN/2023/000456",
    productType: "Business Loan",
    amountPaisa: 3250000,
    paymentDate: "2026-02-10",
    paymentMode: "NACH",
    referenceNumber: "NACH260210456",
    status: "FAILED",
    allocatedToPrincipalPaisa: 0,
    allocatedToInterestPaisa: 0,
  },
  {
    id: "pay-005",
    paymentNumber: "PAY/2026/000067",
    loanNumber: "LN/2024/000123",
    productType: "Personal Loan",
    amountPaisa: 1050000,
    paymentDate: "2026-01-05",
    paymentMode: "UPI",
    referenceNumber: "UPI260105789",
    status: "SUCCESS",
    allocatedToPrincipalPaisa: 624000,
    allocatedToInterestPaisa: 426000,
  },
];

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

const PAYMENT_MODE_LABELS: Record<string, string> = {
  UPI: "UPI",
  NEFT: "NEFT",
  RTGS: "RTGS",
  NACH: "NACH",
  CASH: "Cash",
  CHEQUE: "Cheque",
  ONLINE: "Online",
};

const STATUS_CONFIG: Record<
  string,
  { icon: React.ReactNode; label: string; bg: string; text: string }
> = {
  SUCCESS: {
    icon: <CheckCircle className="h-4 w-4" />,
    label: "Success",
    bg: "bg-green-100",
    text: "text-green-700",
  },
  FAILED: {
    icon: <XCircle className="h-4 w-4" />,
    label: "Failed",
    bg: "bg-red-100",
    text: "text-red-700",
  },
  PENDING: {
    icon: <Clock className="h-4 w-4" />,
    label: "Pending",
    bg: "bg-yellow-100",
    text: "text-yellow-700",
  },
  REVERSED: {
    icon: <RefreshCw className="h-4 w-4" />,
    label: "Reversed",
    bg: "bg-gray-100",
    text: "text-gray-600",
  },
};

export default function PaymentsPage() {
  const totalPaid = MOCK_PAYMENTS.filter((p) => p.status === "SUCCESS").reduce(
    (s, p) => s + p.amountPaisa,
    0,
  );
  const successCount = MOCK_PAYMENTS.filter((p) => p.status === "SUCCESS").length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-4 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/portal/dashboard">
            <ArrowLeft className="h-5 w-5 text-white" />
          </Link>
          <div>
            <h1 className="text-base font-bold">Payment History</h1>
            <p className="text-blue-200 text-xs">All transactions</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-8">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <CreditCard className="h-5 w-5 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{successCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Successful Payments</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-2" />
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Paid</p>
          </div>
        </div>

        {/* Payment List */}
        <div className="space-y-3">
          {MOCK_PAYMENTS.map((payment) => {
            const statusCfg = STATUS_CONFIG[payment.status] ?? STATUS_CONFIG.PENDING;
            return (
              <div
                key={payment.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {payment.productType}
                      </p>
                      <p className="text-xs text-gray-500">{payment.loanNumber}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.text}`}
                    >
                      {statusCfg.icon}
                      {statusCfg.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(payment.amountPaisa)}
                    </p>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{formatDate(payment.paymentDate)}</p>
                      <p className="text-xs text-gray-400">
                        {PAYMENT_MODE_LABELS[payment.paymentMode] ?? payment.paymentMode}
                      </p>
                    </div>
                  </div>

                  {payment.status === "SUCCESS" && (
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-2">
                      <div>
                        <p className="text-xs text-gray-400">Principal</p>
                        <p className="text-xs font-medium text-gray-700">
                          {formatCurrency(payment.allocatedToPrincipalPaisa)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Interest</p>
                        <p className="text-xs font-medium text-gray-700">
                          {formatCurrency(payment.allocatedToInterestPaisa)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-400">{payment.paymentNumber}</p>
                    {payment.referenceNumber && (
                      <p className="text-xs text-gray-400">
                        Ref: {payment.referenceNumber}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Showing last {MOCK_PAYMENTS.length} transactions
        </p>
      </main>
    </div>
  );
}
