"use client";

import { cn } from "@/lib/utils";

interface LeadScoreBadgeProps {
  score: number;
  grade: string;
  gradeLabel: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; ring: string; fill: string }> = {
  A: { bg: "bg-green-50", text: "text-green-700", ring: "ring-green-500", fill: "#22c55e" },
  B: { bg: "bg-yellow-50", text: "text-yellow-700", ring: "ring-yellow-500", fill: "#eab308" },
  C: { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-500", fill: "#f97316" },
  D: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-500", fill: "#ef4444" },
  F: { bg: "bg-gray-50", text: "text-gray-600", ring: "ring-gray-400", fill: "#6b7280" },
};

const SIZE_CONFIG = {
  sm: { outer: 40, stroke: 3, fontSize: "text-xs", labelSize: "text-[10px]", badgePx: "px-1.5 py-0.5 text-xs" },
  md: { outer: 56, stroke: 4, fontSize: "text-sm", labelSize: "text-xs", badgePx: "px-2 py-1 text-sm" },
  lg: { outer: 80, stroke: 5, fontSize: "text-base", labelSize: "text-xs", badgePx: "px-3 py-1.5 text-sm" },
};

export function LeadScoreBadge({
  score,
  grade,
  gradeLabel,
  size = "md",
  className,
}: LeadScoreBadgeProps) {
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS["F"];
  const cfg = SIZE_CONFIG[size];

  const radius = (cfg.outer - cfg.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const dashOffset = circumference - (clampedScore / 100) * circumference;
  const center = cfg.outer / 2;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {/* Circular gauge */}
      <div className="relative flex-shrink-0" style={{ width: cfg.outer, height: cfg.outer }}>
        <svg width={cfg.outer} height={cfg.outer} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={cfg.stroke}
          />
          {/* Score arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.fill}
            strokeWidth={cfg.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        {/* Score number in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold leading-none", cfg.fontSize, colors.text)}>
            {score}
          </span>
        </div>
      </div>

      {/* Grade badge + label */}
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full font-bold ring-1 ring-inset",
            colors.bg,
            colors.text,
            colors.ring,
            cfg.badgePx,
          )}
        >
          {grade}
        </span>
        <span className={cn("text-gray-500 leading-tight", cfg.labelSize)}>
          {gradeLabel}
        </span>
      </div>
    </div>
  );
}

/** Compact inline version — just the grade badge with score tooltip */
export function LeadScoreChip({
  score,
  grade,
  gradeLabel,
}: Pick<LeadScoreBadgeProps, "score" | "grade" | "gradeLabel">) {
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS["F"];

  return (
    <span
      title={`${gradeLabel} — Score: ${score}/100`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset cursor-default",
        colors.bg,
        colors.text,
        colors.ring,
      )}
    >
      <span>{grade}</span>
      <span className="opacity-70">{score}</span>
    </span>
  );
}
