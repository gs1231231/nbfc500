import Link from "next/link";
import {
  Shield,
  FileText,
  CreditCard,
  BarChart3,
  GitMerge,
  Settings,
  Layers,
  Database,
  CheckCircle2,
  ArrowRight,
  Star,
  Phone,
  Mail,
  ChevronRight,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Loan Origination",
    desc: "Lead to disbursement in minutes. Digital KYC, automated credit scoring, instant approvals.",
  },
  {
    icon: CreditCard,
    title: "Loan Management",
    desc: "EMI schedules, payment tracking, NPA management, and prepayment handling — all automated.",
  },
  {
    icon: Shield,
    title: "Credit Bureau",
    desc: "Real-time CIBIL, Experian, and CRIF integration for instant bureau pulls and decisioning.",
  },
  {
    icon: Settings,
    title: "Business Rule Engine",
    desc: "Customizable credit policies per product. No-code rule builder for risk and eligibility.",
  },
  {
    icon: Phone,
    title: "Collections",
    desc: "AI-powered strategy engine with field agent app, geo-tracking, and automated dunning.",
  },
  {
    icon: GitMerge,
    title: "Co-Lending",
    desc: "RBI CLA 2025 compliant. Auto-settlement, partner bank reconciliation, and reporting.",
  },
  {
    icon: Layers,
    title: "Custom Workflows",
    desc: "Design your own loan processing flow with a drag-and-drop workflow builder.",
  },
  {
    icon: Database,
    title: "Dynamic Fields",
    desc: "Add custom fields per product without any code changes. Total flexibility for any NBFC.",
  },
];

const stats = [
  { value: "500+ Cr", label: "AUM Managed" },
  { value: "50+", label: "NBFC Clients" },
  { value: "99.9%", label: "Uptime" },
  { value: "RBI", label: "Compliant" },
];

const steps = [
  {
    number: "01",
    title: "Sign Up",
    desc: "Create your account in minutes. No credit card required for the trial.",
  },
  {
    number: "02",
    title: "Configure Products & Workflows",
    desc: "Set up your loan products, credit rules, and workflows using our no-code tools.",
  },
  {
    number: "03",
    title: "Go Live in Days",
    desc: "Start disbursing loans with full regulatory compliance. Our team supports every step.",
  },
];

const pricingTiers = [
  {
    name: "Starter",
    price: "₹25,000",
    period: "/month",
    desc: "Perfect for new NBFCs just getting started.",
    features: [
      "Up to 1,000 active loans",
      "5 user seats",
      "Basic modules (Origination + LMS)",
      "Standard reports",
      "Email support",
    ],
    highlight: false,
    cta: "Start Trial",
  },
  {
    name: "Growth",
    price: "₹75,000",
    period: "/month",
    desc: "For growing NBFCs scaling their operations.",
    features: [
      "Up to 10,000 active loans",
      "25 user seats",
      "All modules included",
      "Full API access",
      "Priority support",
      "Bureau integrations",
    ],
    highlight: true,
    cta: "Start Trial",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: " pricing",
    desc: "For large NBFCs and MFIs with custom needs.",
    features: [
      "Unlimited loans & users",
      "Dedicated success manager",
      "Custom integrations",
      "On-premise or private cloud",
      "SLA-backed uptime",
      "Co-lending module",
    ],
    highlight: false,
    cta: "Contact Us",
  },
];

const testimonials = [
  {
    quote:
      "NBFC Sathi transformed how we run our NBFC. We went from 3-day disbursement to same-day. Our team loves the collections module — recovery rates improved 30% in the first quarter.",
    name: "Vikram Mehta",
    title: "CEO, Adarsh Finance Pvt. Ltd.",
    initials: "VM",
  },
  {
    quote:
      "The co-lending module alone saved us weeks of manual reconciliation every month. RBI compliance is built right in. I'd recommend NBFC Sathi to every NBFC operator in India.",
    name: "Priya Nair",
    title: "MD, Sahakar Capital",
    initials: "PN",
  },
  {
    quote:
      "We evaluated five platforms before choosing NBFC Sathi. Nothing else came close in terms of feature depth, Indian regulatory alignment, and value for money.",
    name: "Suresh Babu",
    title: "Director & CTO, NexGen Finserv",
    initials: "SB",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">NBFC Sathi</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
                Pricing
              </a>
              <a href="#about" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
                About
              </a>
              <a href="#contact" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
                Contact
              </a>
            </nav>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-700/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-grid-white/[0.03] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-36">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              RBI CLA 2025 Compliant — Ready for Co-Lending
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
              The Operating System<br />
              <span className="text-blue-400">for Modern NBFCs</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 leading-relaxed mb-10 max-w-2xl">
              End-to-end lending platform built for Indian NBFCs. From lead to recovery — all in one place. Launch in days, not months.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/40"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                See Demo
              </Link>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5 text-center"
              >
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything your NBFC needs
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              A fully integrated platform covering every stage of the lending lifecycle — so you can focus on growing your business.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                    <Icon className="h-5 w-5 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-500">
              From sign-up to live disbursements in just three steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* connector line */}
            <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-px bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200" />

            {steps.map((step, idx) => (
              <div key={idx} className="relative text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-600 text-white text-2xl font-bold mb-6 shadow-lg shadow-blue-200">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-gray-500">
              Start free. Scale as you grow. No hidden fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-8 border ${
                  tier.highlight
                    ? "bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-200 scale-105"
                    : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400 text-amber-900 text-xs font-bold">
                      <Star className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-lg font-bold mb-1 ${tier.highlight ? "text-white" : "text-gray-900"}`}>
                    {tier.name}
                  </h3>
                  <p className={`text-sm mb-4 ${tier.highlight ? "text-blue-100" : "text-gray-500"}`}>
                    {tier.desc}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-extrabold ${tier.highlight ? "text-white" : "text-gray-900"}`}>
                      {tier.price}
                    </span>
                    <span className={`text-sm ${tier.highlight ? "text-blue-200" : "text-gray-500"}`}>
                      {tier.period}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle2
                        className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                          tier.highlight ? "text-blue-200" : "text-blue-600"
                        }`}
                      />
                      <span className={`text-sm ${tier.highlight ? "text-blue-100" : "text-gray-600"}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.name === "Enterprise" ? "#contact" : "/signup"}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    tier.highlight
                      ? "bg-white text-blue-600 hover:bg-blue-50"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Trusted by NBFC leaders across India
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-gray-50 rounded-2xl p-8 border border-gray-100"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6 italic">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.title}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to transform your NBFC?
          </h2>
          <p className="text-lg text-blue-100 mb-10">
            Join 50+ NBFCs that run on NBFC Sathi. Start your free trial today — no credit card required.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition-colors shadow-lg"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-white/40 text-white font-bold hover:bg-white/10 transition-colors"
            >
              Schedule Demo
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contact" className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            {/* Brand */}
            <div className="lg:col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-bold text-white">NBFC Sathi</span>
              </Link>
              <p className="text-sm leading-relaxed max-w-xs">
                The complete lending operating system for Indian NBFCs and MFIs. Built with RBI compliance at its core.
              </p>
              <div className="flex flex-col gap-2 mt-6">
                <a href="mailto:info@nbfcsathi.com" className="flex items-center gap-2 text-sm hover:text-white transition-colors">
                  <Mail className="h-4 w-4" />
                  info@nbfcsathi.com
                </a>
                <a href="tel:+919876543210" className="flex items-center gap-2 text-sm hover:text-white transition-colors">
                  <Phone className="h-4 w-4" />
                  +91 98765 43210
                </a>
              </div>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-3 text-sm">
                {["About", "Careers", "Contact", "Blog"].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm">
                {["Features", "Pricing", "Documentation", "API Reference"].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-3 text-sm">
                {["Privacy Policy", "Terms of Service", "Security"].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs">© 2025 NBFC Sathi. All rights reserved.</p>
            <p className="text-xs">Made in India 🇮🇳 for Indian NBFCs</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
