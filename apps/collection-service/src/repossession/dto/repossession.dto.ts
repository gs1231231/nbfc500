export class CreateRepossessionCaseDto {
  loanId!: string;
  assetType!: string; // VEHICLE / PROPERTY / EQUIPMENT
  assetDescription!: string;
  assetRegistrationNumber!: string;
  estimatedValuePaisa!: number;
  outstandingAmountPaisa!: number;
  initiationReason!: string;
  remarks?: string;
}

export class UpdateRepossessionCaseDto {
  status?: string;
  remarks?: string;
}

export class RecordSeizureDto {
  seizureDate!: string;
  latitude!: number;
  longitude!: number;
  address!: string;
  conditionReport!: string;
  odometerReading?: number;
  witnessName?: string;
  witnessPhone?: string;
  // photos stored as mock URL references
  photoUrls?: string[];
  remarks?: string;
}

export class YardEntryDto {
  yardName!: string;
  yardAddress!: string;
  yardContactPhone!: string;
  entryDate!: string;
  dailyStorageChargePaisa!: number;
  insurancePolicyNumber!: string;
  insuranceAmountPaisa!: number;
  insuranceExpiryDate!: string;
  remarks?: string;
}

export class CreateAuctionDto {
  auctionType!: string; // PHYSICAL / ONLINE
  auctionDate!: string;
  auctionVenue!: string;
  reservePricePaisa!: number;
  auctioneerName!: string;
  auctioneerContact!: string;
  advertisementDetails?: string;
  remarks?: string;
}

export class RecordBidDto {
  bidderName!: string;
  bidderPhone!: string;
  bidderPan!: string;
  bidAmountPaisa!: number;
  bidTime!: string;
  status!: string; // SUBMITTED / ACCEPTED / REJECTED
  remarks?: string;
}

export class RecordSaleDto {
  salePricePaisa!: number;
  buyerName!: string;
  buyerPhone!: string;
  buyerPan!: string;
  saleDate!: string;
  paymentMode!: string;
  referenceNumber!: string;
  settlementAmountPaisa!: number;
  surplusAmountPaisa?: number;
  remarks?: string;
}
