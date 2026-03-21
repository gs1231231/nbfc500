"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Loader2, Shield } from "lucide-react";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{10}$/.test(phone)) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    // Mock OTP send
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setStep("otp");
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    if (otp === "000000" || otp.length === 6) {
      localStorage.setItem("customer_phone", phone);
      localStorage.setItem("customer_token", "mock-customer-token");
      router.push("/portal/dashboard");
    } else {
      setError("Invalid OTP. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
            <Shield className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">BankOS</h1>
          <p className="text-blue-200 mt-1">Customer Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {step === "phone" ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your registered mobile number to receive an OTP
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mobile Number
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      required
                      maxLength={10}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || phone.length !== 10}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-4 w-4" />
                      Send OTP
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Verify OTP</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter the 6-digit OTP sent to{" "}
                <span className="font-medium text-gray-700">+91 {phone}</span>
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="------"
                    required
                    maxLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-center">
                    Demo: enter any 6 digits
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Sign In"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Change mobile number
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-blue-200 mt-6">
          Having trouble? Call us at{" "}
          <a href="tel:18001234567" className="underline">1800-123-4567</a>
        </p>
      </div>
    </div>
  );
}
