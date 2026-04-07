export class AddPolicyDto {
  customerId!: string;
  policyType!: string;       // CREDIT_LIFE | PROPERTY | VEHICLE | HEALTH | KEYMAN
  providerName!: string;
  policyNumber?: string;
  premiumPaisa!: number;
  sumInsuredPaisa!: number;
  startDate!: string;
  endDate!: string;
  renewalDueDate?: string;
  nomineeId?: string;
}

export class UpdatePolicyDto {
  policyNumber?: string;
  providerName?: string;
  premiumPaisa?: number;
  sumInsuredPaisa?: number;
  endDate?: string;
  renewalDueDate?: string;
  nomineeId?: string;
  status?: string;           // ACTIVE | EXPIRED | CLAIMED | CANCELLED
}

export class InitiateClaimDto {
  claimType!: string;        // DEATH | DISABILITY | PROPERTY_DAMAGE | VEHICLE_LOSS | CRITICAL_ILLNESS
  claimDate!: string;
  estimatedClaimAmountPaisa?: number;
  remarks?: string;
}
