"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { X, Sparkles, ArrowRight, Eye, FileText, CreditCard, BarChart3, Shield } from "lucide-react";

const DEMO_STEPS = [
  { icon: Eye, label: "View Dashboard", path: "/", desc: "See live metrics and pipeline overview" },
  { icon: FileText, label: "Browse Applications", path: "/applications", desc: "View loan applications pipeline" },
  { icon: Shield, label: "Create a Lead", path: "/leads/new", desc: "Try Aadhaar OTP-based lead creation" },
  { icon: CreditCard, label: "View Loans", path: "/loans", desc: "See active loans and EMI schedules" },
  { icon: BarChart3, label: "Collections", path: "/collections", desc: "Explore collection dashboard" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);
  const [demoUser, setDemoUser] = useState<{ firstName?: string; roles?: string[] } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Auth guard: redirect to login if no token present
    const token = localStorage.getItem("bankos_token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    try {
      const userStr = localStorage.getItem("bankos_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setDemoUser(user);
        // Detect demo mode: demo accounts have these specific emails
        const demoEmails = ["rajesh.kumar@growthfinance.in", "suresh.patil@quickcash.in"];
        if (demoEmails.includes(user.email)) {
          setIsDemo(true);
        }
      }
    } catch {}

    setAuthChecked(true);
  }, []);

  // Show a neutral loading screen while the auth check runs to prevent a white flash
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading&hellip;</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden lg:ml-0">
        {/* Demo Mode Banner */}
        {isDemo && !demoBannerDismissed && (
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-amber-950 px-4 py-2.5 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-semibold">
                Demo Mode
              </span>
              <span className="text-sm hidden sm:inline">
                — You are exploring NBFC Sathi as {demoUser?.firstName || "a demo user"}. All data is sample data.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/signup"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-950 text-amber-100 text-xs font-semibold hover:bg-amber-900 transition-colors"
              >
                Start Your Own Trial
                <ArrowRight className="h-3 w-3" />
              </Link>
              <button
                onClick={() => setDemoBannerDismissed(true)}
                className="p-0.5 rounded hover:bg-amber-600/30 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Demo Quick Actions */}
        {isDemo && !demoBannerDismissed && (
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-gray-500 font-medium whitespace-nowrap mr-1">Try:</span>
              {DEMO_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <button
                    key={step.path}
                    onClick={() => router.push(step.path)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors whitespace-nowrap"
                    title={step.desc}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {step.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
