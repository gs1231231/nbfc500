"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle,
  ChevronRight,
  Loader2,
  ShieldCheck,
  User,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SendOtpResponse {
  txnId: string;
  maskedAadhaar: string;
}

interface EkycCustomer {
  id: string;
  customerNumber: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  currentCity?: string;
  currentState?: string;
  currentPincode?: string;
  currentAddressLine1?: string;
  currentAddressLine2?: string;
  kycStatus: string;
}

interface LeadApplication {
  id: string;
  applicationNumber: string;
  status: string;
  requestedAmountPaisa: number;
  requestedTenureMonths: number;
  product?: { name: string };
  branch?: { name: string };
}

interface VerifyOtpResponse {
  customer: EkycCustomer;
  application: LeadApplication;
  isExisting: boolean;
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

const STEPS = [
  { label: "Enter Aadhaar", icon: ShieldCheck },
  { label: "Verify OTP", icon: ShieldCheck },
  { label: "Loan Details", icon: FileText },
  { label: "Success", icon: CheckCircle },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const Icon = step.icon;
        return (
          <div key={index} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                  isCompleted
                    ? "border-blue-600 bg-blue-600 text-white"
                    : isActive
                    ? "border-blue-600 bg-white text-blue-600"
                    : "border-gray-300 bg-white text-gray-400"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${
                  isActive ? "text-blue-600" : isCompleted ? "text-blue-500" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`mx-2 h-0.5 w-12 mt-[-18px] transition-colors ${
                  isCompleted ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 — Enter Aadhaar ──────────────────────────────────────────────────

function Step1AadhaarInput({
  onSuccess,
}: {
  onSuccess: (txnId: string, maskedAadhaar: string, aadhaarNumber: string) => void;
}) {
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      setError("Aadhaar number must be exactly 12 digits.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.post<SendOtpResponse>("/leads/aadhaar/send-otp", {
        aadhaarNumber,
      });
      onSuccess(res.txnId, res.maskedAadhaar, aadhaarNumber);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Aadhaar Number
        </label>
        <Input
          type="text"
          inputMode="numeric"
          maxLength={12}
          placeholder="Enter 12-digit Aadhaar number"
          value={aadhaarNumber}
          onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ""))}
          className="font-mono text-base tracking-widest"
        />
        <p className="mt-1.5 text-xs text-gray-500">
          An OTP will be sent to the mobile number linked with this Aadhaar.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 border border-red-200">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading || aadhaarNumber.length !== 12} className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending OTP...
          </>
        ) : (
          <>
            Send OTP <ChevronRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

// ─── Step 2 — Verify OTP ─────────────────────────────────────────────────────

function Step2VerifyOtp({
  txnId,
  maskedAadhaar,
  aadhaarNumber,
  onSuccess,
  onBack,
}: {
  txnId: string;
  maskedAadhaar: string;
  aadhaarNumber: string;
  onSuccess: (customer: EkycCustomer, application: LeadApplication, isExisting: boolean) => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [productId, setProductId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [requestedTenure, setRequestedTenure] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // For the verify step, we just need OTP — pass dummy product/branch for now
  // (they'll be entered in step 3 for real, but the API requires them at verify time)
  // We use placeholder UUIDs that will be replaced by step 3's form values.
  // To keep the flow simple, we ask for basic loan details here so the single API
  // call can create the lead in one shot.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError("OTP must be exactly 6 digits.");
      return;
    }
    if (!productId || !branchId || !requestedAmount || !requestedTenure) {
      setError("Please fill in all loan details.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.post<VerifyOtpResponse>("/leads/aadhaar/verify-otp", {
        txnId,
        otp,
        aadhaarNumber,
        productId,
        branchId,
        requestedAmountPaisa: Math.round(parseFloat(requestedAmount) * 100),
        requestedTenureMonths: parseInt(requestedTenure, 10),
      });
      onSuccess(res.customer, res.application, res.isExisting);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "OTP verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Masked Aadhaar info */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
        <p className="text-sm text-blue-800">
          OTP sent to mobile linked with Aadhaar{" "}
          <span className="font-mono font-semibold">{maskedAadhaar}</span>
        </p>
        <p className="text-xs text-blue-600 mt-0.5">
          Use <span className="font-mono font-bold">123456</span> as OTP in this demo environment.
        </p>
      </div>

      {/* OTP */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Enter OTP</label>
        <Input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          className="font-mono text-lg tracking-[0.5em] text-center"
        />
      </div>

      {/* Loan details (collected here so verify-otp can create the lead in one call) */}
      <div className="border-t border-gray-100 pt-4 space-y-4">
        <p className="text-sm font-medium text-gray-700">Loan Details</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Product ID</label>
            <Input
              placeholder="UUID of loan product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Branch ID</label>
            <Input
              placeholder="UUID of branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Requested Amount (INR)
            </label>
            <Input
              type="number"
              min="1000"
              step="1000"
              placeholder="e.g. 100000"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tenure (months)
            </label>
            <Select
              value={requestedTenure}
              onChange={(e) => setRequestedTenure(e.target.value)}
            >
              <option value="">Select tenure</option>
              {[6, 12, 18, 24, 36, 48, 60, 84, 120].map((m) => (
                <option key={m} value={m}>
                  {m} months
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 border border-red-200">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button type="submit" disabled={loading || otp.length !== 6} className="flex-2 flex-1">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              Verify &amp; Create Lead <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// ─── Step 3 — eKYC Summary (shown after successful verify) ───────────────────

function Step3EkycSummary({
  customer,
  application,
  isExisting,
}: {
  customer: EkycCustomer;
  application: LeadApplication;
  isExisting: boolean;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Full Name", value: customer.fullName },
    { label: "Customer Number", value: customer.customerNumber },
    { label: "Date of Birth", value: customer.dateOfBirth?.split("T")[0] ?? "—" },
    { label: "Gender", value: customer.gender },
    { label: "KYC Status", value: customer.kycStatus },
    {
      label: "Address",
      value: [
        customer.currentAddressLine1,
        customer.currentAddressLine2,
        customer.currentCity,
        customer.currentState,
        customer.currentPincode,
      ]
        .filter(Boolean)
        .join(", ") || "—",
    },
  ];

  return (
    <div className="space-y-6">
      {isExisting && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Existing customer found — a new application has been linked to the existing profile.
        </div>
      )}

      {/* Customer Info */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <User className="h-4 w-4 text-blue-500" />
          Customer Details (from Aadhaar eKYC)
        </p>
        <dl className="rounded-lg border border-gray-200 divide-y divide-gray-100">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex px-4 py-2.5 text-sm">
              <dt className="w-40 text-gray-500 shrink-0">{label}</dt>
              <dd className="text-gray-900 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Application Info */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          Application Created
        </p>
        <dl className="rounded-lg border border-gray-200 divide-y divide-gray-100">
          <div className="flex px-4 py-2.5 text-sm">
            <dt className="w-40 text-gray-500 shrink-0">Application No.</dt>
            <dd className="text-gray-900 font-mono font-semibold">{application.applicationNumber}</dd>
          </div>
          <div className="flex px-4 py-2.5 text-sm">
            <dt className="w-40 text-gray-500 shrink-0">Status</dt>
            <dd>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {application.status}
              </span>
            </dd>
          </div>
          {application.product && (
            <div className="flex px-4 py-2.5 text-sm">
              <dt className="w-40 text-gray-500 shrink-0">Product</dt>
              <dd className="text-gray-900">{application.product.name}</dd>
            </div>
          )}
          <div className="flex px-4 py-2.5 text-sm">
            <dt className="w-40 text-gray-500 shrink-0">Amount</dt>
            <dd className="text-gray-900 font-medium">
              ₹{(application.requestedAmountPaisa / 100).toLocaleString("en-IN")}
            </dd>
          </div>
          <div className="flex px-4 py-2.5 text-sm">
            <dt className="w-40 text-gray-500 shrink-0">Tenure</dt>
            <dd className="text-gray-900">{application.requestedTenureMonths} months</dd>
          </div>
        </dl>
      </div>

      <div className="flex gap-3 pt-2">
        <Link href="/applications" className="flex-1">
          <Button variant="outline" className="w-full">
            View All Applications
          </Button>
        </Link>
        <Link href={`/applications/${application.id}`} className="flex-1">
          <Button className="w-full">
            Open Application <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewLeadPage() {
  // step: 0=aadhaar, 1=otp, 2=success
  const [step, setStep] = useState(0);

  // Step 1 state
  const [txnId, setTxnId] = useState("");
  const [maskedAadhaar, setMaskedAadhaar] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");

  // Step 2 result
  const [resultCustomer, setResultCustomer] = useState<EkycCustomer | null>(null);
  const [resultApplication, setResultApplication] = useState<LeadApplication | null>(null);
  const [isExisting, setIsExisting] = useState(false);

  const handleOtpSent = (
    txn: string,
    masked: string,
    aadhaar: string,
  ) => {
    setTxnId(txn);
    setMaskedAadhaar(masked);
    setAadhaarNumber(aadhaar);
    setStep(1);
  };

  const handleVerified = (
    customer: EkycCustomer,
    application: LeadApplication,
    existing: boolean,
  ) => {
    setResultCustomer(customer);
    setResultApplication(application);
    setIsExisting(existing);
    setStep(2);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Applications
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Lead</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verify customer identity via Aadhaar OTP to create a loan lead.
        </p>
      </div>

      <StepIndicator currentStep={step} />

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 0 && "Step 1 — Enter Aadhaar"}
            {step === 1 && "Step 2 — Verify OTP & Loan Details"}
            {step === 2 && "Lead Created Successfully"}
          </CardTitle>
          <CardDescription>
            {step === 0 &&
              "Enter the applicant's 12-digit Aadhaar number to receive an OTP on their registered mobile."}
            {step === 1 &&
              "Enter the OTP and loan details. On success a customer record and LEAD application will be created."}
            {step === 2 &&
              "The customer has been verified via Aadhaar eKYC and a loan application has been created."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === 0 && <Step1AadhaarInput onSuccess={handleOtpSent} />}

          {step === 1 && (
            <Step2VerifyOtp
              txnId={txnId}
              maskedAadhaar={maskedAadhaar}
              aadhaarNumber={aadhaarNumber}
              onSuccess={(customer, application, existing) => {
                handleVerified(customer, application, existing);
              }}
              onBack={() => setStep(0)}
            />
          )}

          {step === 2 && resultCustomer && resultApplication && (
            <Step3EkycSummary
              customer={resultCustomer}
              application={resultApplication}
              isExisting={isExisting}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
