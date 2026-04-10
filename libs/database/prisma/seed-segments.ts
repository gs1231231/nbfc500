/**
 * seed-segments.ts — Standalone seeder for Customer Segmentation Engine
 * Run: npx ts-node libs/database/prisma/seed-segments.ts
 *
 * Safe to run multiple times (uses upsert).
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding customer segments...');

  // Find the primary org (Growth Finance)
  const org = await prisma.organization.findFirst({
    where: { code: 'GROWTH' },
  });
  if (!org) {
    console.error('Organization GROWTH not found. Run the main seed first.');
    process.exit(1);
  }

  const adminUser = await prisma.user.findFirst({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const seedUserId = adminUser?.id ?? 'system';

  // Helper to get scheme ID by code
  const schemeByCode = async (code: string): Promise<string | null> => {
    const s = await prisma.scheme.findFirst({
      where: { organizationId: org.id, schemeCode: code },
    });
    return s?.id ?? null;
  };

  const [salSpecialId, btBonanzaId, diwaliId, corpHdfcId] = await Promise.all([
    schemeByCode('SAL-SPECIAL-2026'),
    schemeByCode('BT-BONANZA-2026'),
    schemeByCode('DIWALI-2026'),
    schemeByCode('CORP-HDFC-2026'),
  ]);

  console.log('  Scheme IDs resolved:', {
    salSpecialId,
    btBonanzaId,
    diwaliId,
    corpHdfcId,
  });

  const segmentDefs = [
    {
      segmentCode: 'PREMIUM-SALARIED',
      segmentName: 'Premium Salaried',
      description: 'High-income salaried employees with excellent credit score (750+).',
      segmentType: 'INCOME',
      priority: 100,
      rules: [
        { field: 'customer.employmentType', operator: 'EQ', value: 'SALARIED' },
        { field: 'customer.monthlyIncomePaisa', operator: 'GTE', value: 10000000 },
        { field: 'bureau.score', operator: 'GTE', value: 750 },
      ],
      mappedSchemeIds: [salSpecialId, corpHdfcId].filter((x): x is string => x !== null),
      offerPriority: 'BEST_RATE',
      maxOffersToShow: 3,
    },
    {
      segmentCode: 'YOUNG-PROFESSIONAL',
      segmentName: 'Young Professional',
      description: 'Salaried or self-employed professionals aged 22–35 with good credit.',
      segmentType: 'DEMOGRAPHIC',
      priority: 90,
      rules: [
        { field: 'customer.age', operator: 'BETWEEN', value: 22, value2: 35 },
        {
          field: 'customer.employmentType',
          operator: 'IN',
          value: ['SALARIED', 'SELF_EMPLOYED_PROFESSIONAL'],
        },
        { field: 'bureau.score', operator: 'GTE', value: 700 },
      ],
      mappedSchemeIds: [salSpecialId].filter((x): x is string => x !== null),
      offerPriority: 'BEST_RATE',
      maxOffersToShow: 2,
    },
    {
      segmentCode: 'HIGH-NET-WORTH',
      segmentName: 'High Net Worth',
      description: 'Customers with monthly income above ₹2.5 lakh — all schemes eligible.',
      segmentType: 'INCOME',
      priority: 95,
      rules: [
        { field: 'customer.monthlyIncomePaisa', operator: 'GTE', value: 25000000 },
      ],
      mappedSchemeIds: [salSpecialId, btBonanzaId, diwaliId, corpHdfcId].filter(
        (x): x is string => x !== null,
      ),
      offerPriority: 'BEST_RATE',
      maxOffersToShow: 4,
    },
    {
      segmentCode: 'MSME-OWNER',
      segmentName: 'MSME Business Owner',
      description: 'Self-employed business owners operating through a registered entity.',
      segmentType: 'BEHAVIORAL',
      priority: 80,
      rules: [
        {
          field: 'customer.employmentType',
          operator: 'IN',
          value: ['SELF_EMPLOYED_BUSINESS'],
        },
        {
          field: 'customer.customerType',
          operator: 'IN',
          value: ['PROPRIETORSHIP', 'PARTNERSHIP', 'PRIVATE_LIMITED'],
        },
      ],
      mappedSchemeIds: [btBonanzaId].filter((x): x is string => x !== null),
      offerPriority: 'LOWEST_FEE',
      maxOffersToShow: 2,
    },
    {
      segmentCode: 'EXISTING-GOOD',
      segmentName: 'Existing Customer — Good Standing',
      description: 'Existing borrowers with at least one loan and max DPD ≤ 30 days.',
      segmentType: 'LOYALTY',
      priority: 85,
      rules: [
        { field: 'loan.existingLoanCount', operator: 'GTE', value: 1 },
        { field: 'loan.maxDpd', operator: 'LTE', value: 30 },
      ],
      mappedSchemeIds: [btBonanzaId].filter((x): x is string => x !== null),
      offerPriority: 'BEST_RATE',
      maxOffersToShow: 2,
    },
    {
      segmentCode: 'RURAL-SEMI-URBAN',
      segmentName: 'Rural / Semi-Urban',
      description: 'Customers from rural or semi-urban areas (pincode starting with 3).',
      segmentType: 'GEOGRAPHIC',
      priority: 70,
      rules: [{ field: 'customer.pincode', operator: 'STARTS_WITH', value: '3' }],
      mappedSchemeIds: [diwaliId].filter((x): x is string => x !== null),
      offerPriority: 'LOWEST_FEE',
      maxOffersToShow: 2,
    },
  ];

  for (const seg of segmentDefs) {
    await prisma.customerSegment.upsert({
      where: {
        organizationId_segmentCode: {
          organizationId: org.id,
          segmentCode: seg.segmentCode,
        },
      },
      update: {
        segmentName: seg.segmentName,
        description: seg.description,
        rules: seg.rules,
        mappedSchemeIds: seg.mappedSchemeIds.length > 0
          ? seg.mappedSchemeIds
          : Prisma.JsonNull,
        priority: seg.priority,
        offerPriority: seg.offerPriority,
        maxOffersToShow: seg.maxOffersToShow,
      },
      create: {
        organizationId: org.id,
        segmentCode: seg.segmentCode,
        segmentName: seg.segmentName,
        description: seg.description,
        segmentType: seg.segmentType,
        priority: seg.priority,
        isActive: true,
        isAutoAssign: true,
        rules: seg.rules,
        mappedSchemeIds: seg.mappedSchemeIds.length > 0
          ? seg.mappedSchemeIds
          : Prisma.JsonNull,
        mappedProductIds: Prisma.JsonNull,
        offerPriority: seg.offerPriority,
        maxOffersToShow: seg.maxOffersToShow,
        createdBy: seedUserId,
      },
    });
    console.log(`  Upserted: ${seg.segmentCode} — ${seg.segmentName}`);
  }

  console.log(`\nDone: ${segmentDefs.length} customer segments seeded.`);
}

main()
  .catch((e) => {
    console.error('Segment seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
