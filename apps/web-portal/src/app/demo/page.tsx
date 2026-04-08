"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  Play,
  Building2,
  Loader2,
  ArrowLeft,
  Users,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { authApi } from "@/lib/api";

const demoAccounts = [
  {
    id: "nbfc",
    label: "NBFC Demo",
    company: "Growth Finance Pvt. Ltd.",
    email: "rajesh.kumar@growthfinance.in",
    password: "Test@1234",
    icon: Building2,
    color: "blue",
    description: "Full-featured NBFC setup with personal loans, business loans, and co-lending.",
    highlights: ["Loan Origination", "Collections Module", "BRE Rules", "Co-Lending"],
  },
  {
    id: "mfi",
    label: "MFI Demo",
    company: "QuickCash Microfinance",
    email: "suresh.patil@quickcash.in",
    password: "Test@1234",
    icon: Users,
    color: "purple",
    description: "Microfinance institution setup with group lending, JLG loans, and field agent workflows.",
    highlights: ["Group Lending", "JLG Loans", "Field Agent App", "Bulk Disbursement"],
  },
];

export default function DemoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoLogging, setAutoLogging] = useState(false);

  // Auto-login when ?auto=nbfc or ?auto=mfi is present
  useEffect(() => {
    const autoParam = searchParams.get("auto");
    if (autoParam) {
      const account = demoAccounts.find((a) => a.id === autoParam);
      if (account) {
        setAutoLogging(true);
        handleLaunchDemo(account);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (autoLogging) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-white text-lg font-semibold">Launching demo...</p>
          <p className="text-slate-400 text-sm">Setting up your demo environment</p>
        </div>
      </div>
    );
  }

  const handleLaunchDemo = async (account: (typeof demoAccounts)[0]) => {
    setLoadingId(account.id);
    setError(null);
    try {
      const res = await authApi.login(account.email, account.password);
      localStorage.setItem("bankos_token", res.accessToken);
      localStorage.setItem("bankos_user", JSON.stringify({ ...res.user, email: account.email }));
      localStorage.setItem("bankos_demo", "true");
      router.push("/applications");
    } catch {
      setError(
        `Could not log in to the ${account.label}. Make sure the demo server is running. Credentials: ${account.email} / ${account.password}`
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold">NBFC Sathi</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero text */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium mb-5">
            <Zap className="h-3 w-3" />
            Live demo — real data, instant access
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-5">
            See NBFC Sathi in Action
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Launch a pre-loaded demo environment instantly. No setup required — explore all features with real sample data.
          </p>
        </div>

        {/* Demo Account Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
          {demoAccounts.map((account) => {
            const Icon = account.icon;
            const isLoading = loadingId === account.id;
            const isBlue = account.color === "blue";

            return (
              <div
                key={account.id}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-start gap-4 mb-6">
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 ${
                      isBlue ? "bg-blue-600" : "bg-purple-600"
                    }`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{account.label}</h2>
                    <p className="text-slate-400 text-sm">{account.company}</p>
                  </div>
                </div>

                <p className="text-slate-300 text-sm leading-relaxed mb-5">{account.description}</p>

                <ul className="grid grid-cols-2 gap-2 mb-6">
                  {account.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>

                {/* Credentials */}
                <div className="bg-slate-800/60 rounded-xl p-4 mb-5 font-mono text-xs space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-20">Email</span>
                    <span className="text-green-400 truncate">{account.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-20">Password</span>
                    <span className="text-green-400">{account.password}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleLaunchDemo(account)}
                  disabled={isLoading || loadingId !== null}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    isBlue
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "bg-purple-600 hover:bg-purple-500 text-white"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Launching…
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Launch Demo
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-10 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Video Placeholder */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-3">Watch 5-minute Product Tour</h3>
            <p className="text-slate-400 text-sm mb-8">
              Get a quick overview of all NBFC Sathi features — loan origination, collections, co-lending, and more.
            </p>

            <div className="relative bg-slate-800 rounded-2xl overflow-hidden aspect-video max-w-3xl mx-auto flex items-center justify-center group cursor-pointer hover:bg-slate-700 transition-colors">
              {/* Fake thumbnail */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-slate-900/60" />

              {/* Play button */}
              <div className="relative flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-900 group-hover:scale-110 transition-transform">
                  <Play className="h-9 w-9 text-white ml-1" />
                </div>
                <span className="text-white font-semibold">NBFC Sathi — Full Platform Walkthrough</span>
                <span className="text-slate-400 text-sm">5:24</span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <p className="text-slate-400 text-sm mb-5">
            Liked what you saw? Start your own free trial.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
