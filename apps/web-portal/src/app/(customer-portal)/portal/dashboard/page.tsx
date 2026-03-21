"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Calendar,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  IndianRupee,
  Clock,
} from "lucide-react";

// Mock data for customer portal
const MOCK_CUSTOMER = {
  name: "Rajesh Kumar",
  customerNumber: "CUST-2024-001234",
  phone: "+91 98765 43210",
};

const MOCK_LOANS = [
  {
    id: "loan-001",
    loanNumber: "LN/2024/000123",
    productType: "Personal Loan",
    disbursedAmountPaisa: 50000000, // 5,00,000
    outstandingPrincipalPaisa: 35000000,
    emiAmountPaisa: 1050000, // 10,500
    nextEmiDate: "2026-04-05",
    dpd: 0,
    loanStatus: "ACTIVE",
    tenureMonths: 60,
    completedEmis: 18,
    totalEmis: 60,
  },
  {
    id: "loan-002",
    loanNumber: "LN/2023/000456",
    productType: "Business Loan",
    disbursedAmountPaisa: 150000000, // 15,00,000
    outstandingPrincipalPaisa: 85000000,
    emiAmountPaisa: 3250000, // 32,500
    nextEmiDate: "2026-04-10",
    dpd: 3,
    loanStatus: "ACTIVE",
    tenureMonths: 48,
    completedEmis: 14,
    totalEmis: 48,
  },
];

function formatCurrency(paisa: number): string {
  const rupees = paisa / 100;
  if (rupees >= 100000) {
    return `₹${(rupees / 100000).toFixed(2)}L`;
  }
  return `₹${rupees.toLocaleString("en-IN")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CustomerDashboardPage() {
  const [payingLoanId, setPayingLoanId] = useState<string | null>(null);

  const totalOutstanding = MOCK_LOANS.reduce(
    (s, l) => s + l.outstandingPrincipalPaisa,
    0,
  );
  const nextEmi = MOCK_LOANS.reduce(
    (s, l) => s + l.emiAmountPaisa,
    0,
  );
  const activeLoans = MOCK_LOANS.filter((l) => l.loanStatus === "ACTIVE").length;

  const handlePayNow = (loanId: string) => {
    setPayingLoanId(loanId);
    // In production: redirect to payment gateway or show UPI QR
    setTimeout(() => {
      alert(`UPI Payment Link: upi://pay?pa=bankos@upi&am=${MOCK_LOANS.find(l => l.id === loanId)!.emiAmountPaisa / 100}&tn=EMI Payment&cu=INR`);
      setPayingLoanId(null);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-4 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">BankOS</h1>
            <p className="text-blue-200 text-xs">Customer Portal</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{MOCK_CUSTOMER.name}</p>
            <p className="text-blue-200 text-xs">{MOCK_CUSTOMER.customerNumber}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <CreditCard className="h-5 w-5 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{activeLoans}</p>
            <p className="text-xs text-gray-500 mt-0.5">Active Loans</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <TrendingDown className="h-5 w-5 text-orange-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalOutstanding)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Outstanding</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <Calendar className="h-5 w-5 text-green-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">{formatCurrency(nextEmi)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Next EMI</p>
          </div>
        </div>

        {/* Active Loans */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Your Loans</h2>
            <Link
              href="/portal/payments"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              Payment History <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {MOCK_LOANS.map((loan) => (
              <div
                key={loan.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {loan.productType}
                      </p>
                      <p className="text-xs text-gray-500">{loan.loanNumber}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        loan.dpd === 0
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {loan.dpd === 0 ? (
                        <>
                          <CheckCircle className="h-3 w-3" /> Regular
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" /> DPD {loan.dpd}
                        </>
                      )}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{loan.completedEmis} EMIs paid</span>
                      <span>{loan.totalEmis - loan.completedEmis} remaining</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{
                          width: `${(loan.completedEmis / loan.totalEmis) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Outstanding</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(loan.outstandingPrincipalPaisa)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">EMI Amount</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(loan.emiAmountPaisa)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Next Due</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatDate(loan.nextEmiDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePayNow(loan.id)}
                      disabled={payingLoanId === loan.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <IndianRupee className="h-3.5 w-3.5" />
                      {payingLoanId === loan.id ? "Loading..." : "Pay Now"}
                    </button>
                    <Link
                      href={`/portal/loans/${loan.id}`}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                      Details
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/portal/payments"
              className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-gray-700">Payment History</span>
            </Link>
            <a
              href="tel:18001234567"
              className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-gray-700">Contact Support</span>
            </a>
          </div>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-around">
        <Link href="/portal/dashboard" className="flex flex-col items-center gap-0.5 text-blue-600">
          <CreditCard className="h-5 w-5" />
          <span className="text-xs font-medium">Home</span>
        </Link>
        <Link href="/portal/payments" className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600">
          <Clock className="h-5 w-5" />
          <span className="text-xs">Payments</span>
        </Link>
      </nav>
      <div className="h-16" /> {/* Bottom nav spacer */}
    </div>
  );
}
