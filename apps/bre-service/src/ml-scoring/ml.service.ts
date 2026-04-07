import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@bankos/database';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskBand = 'A' | 'B' | 'C' | 'D' | 'E';

export interface MlScoreResult {
  applicationId: string;
  score: number;
  riskBand: RiskBand;
  probability: number;
  featureImportance: Record<string, number>;
  features: Record<string, number>;
  scoredAt: string;
}

export interface ModelComparisonResult {
  applicationId: string;
  breDecision: string | null;
  mlScore: number;
  mlRiskBand: RiskBand;
  mlProbability: number;
  agreement: boolean;
  recommendation: string;
}

export interface ModelMetrics {
  modelName: string;
  version: string;
  auc: number;
  ks: number;
  gini: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainedOn: string;
  featureCount: number;
}

// ── Feature weights (mock logistic-regression-like weights) ──────────────────

const FEATURE_WEIGHTS: Record<string, number> = {
  age_normalized: 0.08,
  income_normalized: 0.18,
  bureau_score_normalized: 0.30,
  existing_emi_ratio: -0.20,
  employment_type_encoded: 0.10,
  dpd_history_normalized: -0.22,
  loan_amount_to_income_ratio: -0.12,
  tenure_months_normalized: 0.05,
  enquiry_count_normalized: -0.11,
};

const BIAS = 0.15;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate ML credit score for an application.
   * Builds a feature vector from customer + bureau + application data,
   * applies a mock weighted-sum (simulates logistic regression), and
   * maps the output probability to a 0–1000 score and risk band.
   */
  async calculateScore(
    orgId: string,
    applicationId: string,
  ): Promise<MlScoreResult> {
    this.logger.log(`ML scoring application ${applicationId}, org ${orgId}`);

    const application = await this.prisma.loanApplication.findFirst({
      where: { id: applicationId, organizationId: orgId, deletedAt: null },
      include: { customer: true, product: true },
    });
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    // Latest bureau response
    const bureauReq = await this.prisma.bureauRequest.findFirst({
      where: { applicationId, organizationId: orgId, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
      include: { bureauResponse: true },
    });
    const bureau = bureauReq?.bureauResponse ?? null;

    // Build raw features
    const today = new Date();
    const dob = new Date(application.customer.dateOfBirth);
    const age = today.getFullYear() - dob.getFullYear();

    const monthlyIncome = application.customer.monthlyIncomePaisa ?? 0;
    const bureauScore = bureau?.score ?? 600;
    const totalEmi = bureau?.totalEmiObligationPaisa ?? 0;
    const dpd = bureau?.maxDpdLast12Months ?? 0;
    const enquiries = bureau?.enquiriesLast3Months ?? 0;

    // Employment type encoding
    const empType = application.customer.employmentType;
    const employmentEncoded =
      empType === 'SALARIED' ? 1.0
      : empType === 'SELF_EMPLOYED_PROFESSIONAL' ? 0.8
      : empType === 'SELF_EMPLOYED_BUSINESS' ? 0.7
      : empType === 'RETIRED' ? 0.5
      : 0.3;

    const loanAmountToIncomeRatio =
      monthlyIncome > 0
        ? application.requestedAmountPaisa / (monthlyIncome * 12)
        : 5; // penalise unknown income

    const existingEmiRatio =
      monthlyIncome > 0 ? totalEmi / monthlyIncome : 1;

    // Normalize features to [0, 1]
    const features: Record<string, number> = {
      age_normalized: Math.min(Math.max((age - 18) / (65 - 18), 0), 1),
      income_normalized: Math.min(monthlyIncome / 500000, 1), // cap at 5L/month
      bureau_score_normalized: Math.min(Math.max((bureauScore - 300) / (900 - 300), 0), 1),
      existing_emi_ratio: Math.min(existingEmiRatio, 1),
      employment_type_encoded: employmentEncoded,
      dpd_history_normalized: Math.min(dpd / 180, 1), // cap at 180 DPD
      loan_amount_to_income_ratio: Math.min(loanAmountToIncomeRatio / 10, 1),
      tenure_months_normalized: Math.min(
        application.requestedTenureMonths / 360,
        1,
      ),
      enquiry_count_normalized: Math.min(enquiries / 10, 1),
    };

    // Weighted sum + bias → logistic function → probability of being a good borrower
    let logit = BIAS;
    for (const [feat, weight] of Object.entries(FEATURE_WEIGHTS)) {
      logit += weight * (features[feat] ?? 0);
    }
    const probability = 1 / (1 + Math.exp(-logit));

    // Map probability [0,1] → score [0,1000]
    const score = Math.round(probability * 1000);

    // Risk band
    const riskBand = this.probabilityToRiskBand(probability);

    // Feature importance (absolute contribution)
    const featureImportance: Record<string, number> = {};
    for (const [feat, weight] of Object.entries(FEATURE_WEIGHTS)) {
      featureImportance[feat] = Math.round(Math.abs(weight * (features[feat] ?? 0)) * 1000) / 1000;
    }

    this.logger.log(
      `ML score for ${applicationId}: ${score} (${riskBand}), p=${probability.toFixed(3)}`,
    );

    return {
      applicationId,
      score,
      riskBand,
      probability: Math.round(probability * 1000) / 1000,
      featureImportance,
      features,
      scoredAt: new Date().toISOString(),
    };
  }

  /**
   * Run both BRE and ML scoring and compare their outputs.
   */
  async compareModels(
    orgId: string,
    applicationId: string,
  ): Promise<ModelComparisonResult> {
    // Fetch latest BRE decision
    const breDecision = await this.prisma.breDecision.findFirst({
      where: { applicationId, organizationId: orgId },
      orderBy: { decidedAt: 'desc' },
    });

    const mlResult = await this.calculateScore(orgId, applicationId);

    // Determine agreement
    const breOutcome = breDecision?.finalDecision ?? null;
    let mlApprovalEquivalent: boolean;
    if (mlResult.riskBand === 'A' || mlResult.riskBand === 'B') {
      mlApprovalEquivalent = true;
    } else if (mlResult.riskBand === 'E') {
      mlApprovalEquivalent = false;
    } else {
      mlApprovalEquivalent = mlResult.probability >= 0.5;
    }

    let agreement = false;
    if (breOutcome === 'APPROVED' && mlApprovalEquivalent) {
      agreement = true;
    } else if (breOutcome === 'REJECTED' && !mlApprovalEquivalent) {
      agreement = true;
    }

    // Recommendation
    let recommendation: string;
    if (agreement) {
      recommendation = `Both BRE (${breOutcome ?? 'N/A'}) and ML (${mlResult.riskBand}) agree. Proceed with confidence.`;
    } else if (breOutcome === 'APPROVED' && !mlApprovalEquivalent) {
      recommendation = `BRE approved but ML model shows elevated risk (band ${mlResult.riskBand}). Consider manual review.`;
    } else if (breOutcome === 'REJECTED' && mlApprovalEquivalent) {
      recommendation = `BRE rejected but ML model shows low risk (band ${mlResult.riskBand}). Investigate rule triggers for potential override.`;
    } else {
      recommendation = `No BRE decision available. ML score suggests ${mlApprovalEquivalent ? 'approval' : 'rejection'} (band ${mlResult.riskBand}).`;
    }

    return {
      applicationId,
      breDecision: breOutcome,
      mlScore: mlResult.score,
      mlRiskBand: mlResult.riskBand,
      mlProbability: mlResult.probability,
      agreement,
      recommendation,
    };
  }

  /**
   * Return static mock model performance metrics.
   */
  getModelMetrics(): ModelMetrics {
    return {
      modelName: 'BankOS Credit Scorecard v1',
      version: '1.2.0',
      auc: 0.82,
      ks: 0.45,
      gini: 0.64,
      accuracy: 0.78,
      precision: 0.81,
      recall: 0.74,
      f1Score: 0.77,
      trainedOn: '2025-12-01',
      featureCount: Object.keys(FEATURE_WEIGHTS).length,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private probabilityToRiskBand(p: number): RiskBand {
    if (p >= 0.80) return 'A';
    if (p >= 0.65) return 'B';
    if (p >= 0.50) return 'C';
    if (p >= 0.35) return 'D';
    return 'E';
  }
}
