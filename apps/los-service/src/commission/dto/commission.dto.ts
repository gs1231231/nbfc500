export class CreatePayoutDto {
  dsaId!: string;
  month!: string; // YYYY-MM
  remarks?: string;
}

export class ListPayoutsDto {
  dsaId?: string;
  month?: string;
  status?: string;
}
