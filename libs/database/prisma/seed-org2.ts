import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

// Deterministic seed for ORG2
faker.seed(67890);

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomIndianPhone(): string {
  const prefix = faker.helpers.arrayElement(['6', '7', '8', '9']);
  const rest = faker.string.numeric(9);
  return prefix + rest;
}

function randomPAN(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const part1 = Array.from({ length: 5 }, () =>
    letters[Math.floor(Math.random() * letters.length)],
  ).join('');
  const part2 = faker.string.numeric(4);
  const part3 = letters[Math.floor(Math.random() * letters.length)];
  return part1 + part2 + part3;
}

function randomAadhaar(): string {
  return faker.string.numeric(12);
}

/**
 * EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 * where r = annualRateBps / 12 / 10000
 */
function calculateEMI(principalPaisa: number, annualRateBps: number, tenureMonths: number): number {
  const r = new Decimal(annualRateBps).div(12).div(10000);
  const P = new Decimal(principalPaisa);
  const n = tenureMonths;

  if (r.isZero()) {
    return P.div(n).ceil().toNumber();
  }

  const onePlusR = r.plus(1);
  const onePlusRPowN = onePlusR.pow(n);
  const emi = P.mul(r).mul(onePlusRPowN).div(onePlusRPowN.minus(1));
  return emi.ceil().toNumber();
}

function buildAmortizationSchedule(
  principalPaisa: number,
  annualRateBps: number,
  tenureMonths: number,
  disbursementDate: Date,
): {
  installmentNumber: number;
  dueDate: Date;
  emiAmountPaisa: number;
  principalComponentPaisa: number;
  interestComponentPaisa: number;
  openingBalancePaisa: number;
  closingBalancePaisa: number;
}[] {
  const emi = calculateEMI(principalPaisa, annualRateBps, tenureMonths);
  const monthlyRate = new Decimal(annualRateBps).div(12).div(10000);
  const schedule = [];
  let balance = new Decimal(principalPaisa);

  for (let i = 1; i <= tenureMonths; i++) {
    const opening = balance;
    const interest = balance.mul(monthlyRate).ceil();
    let principal = new Decimal(emi).minus(interest);

    // Last instalment: clear remaining balance
    if (i === tenureMonths) {
      principal = balance;
    }

    if (principal.gt(balance)) principal = balance;
    const closing = balance.minus(principal);

    const dueDate = new Date(disbursementDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      installmentNumber: i,
      dueDate,
      emiAmountPaisa: interest.plus(principal).toNumber(),
      principalComponentPaisa: principal.toNumber(),
      interestComponentPaisa: interest.toNumber(),
      openingBalancePaisa: opening.toNumber(),
      closingBalancePaisa: closing.toNumber(),
    });

    balance = closing;
    if (balance.lte(0)) break;
  }

  return schedule;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

// ─── Indian reference data ────────────────────────────────────────────────

const INDIAN_STATES = [
  'Maharashtra',
  'Karnataka',
  'Gujarat',
  'Madhya Pradesh',
  'Telangana',
  'Tamil Nadu',
  'Rajasthan',
  'Uttar Pradesh',
  'West Bengal',
  'Delhi',
];

const CITIES_BY_STATE: Record<string, string[]> = {
  Maharashtra: ['Pune', 'Mumbai', 'Nashik', 'Nagpur', 'Aurangabad'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Hubli', 'Mangaluru', 'Belagavi'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'],
  Delhi: ['New Delhi', 'Dwarka', 'Rohini', 'Saket', 'Lajpat Nagar'],
};

function randomIndianAddress(): {
  line1: string;
  city: string;
  state: string;
  pincode: string;
} {
  const state = faker.helpers.arrayElement(INDIAN_STATES);
  const city = faker.helpers.arrayElement(CITIES_BY_STATE[state]);
  const houseNo = faker.number.int({ min: 1, max: 999 });
  const streets = [
    'MG Road',
    'Station Road',
    'Gandhi Nagar',
    'Nehru Street',
    'Patel Marg',
    'Lal Bahadur Colony',
    'Sector 12',
    'Civil Lines',
    'Model Town',
    'Shastri Nagar',
  ];
  const street = faker.helpers.arrayElement(streets);
  return {
    line1: `${houseNo}, ${street}`,
    city,
    state,
    pincode: faker.string.numeric(6),
  };
}

const INDIAN_FIRST_NAMES_MALE = [
  'Suresh', 'Ramesh', 'Ganesh', 'Mahesh', 'Naresh', 'Dinesh', 'Rajesh', 'Mukesh',
  'Umesh', 'Yogesh', 'Bhavesh', 'Hitesh', 'Nilesh', 'Kamlesh', 'Devesh',
  'Rupesh', 'Santosh', 'Prakash', 'Rakesh', 'Vivek',
];

const INDIAN_FIRST_NAMES_FEMALE = [
  'Sunita', 'Savita', 'Kavita', 'Lalita', 'Mamta', 'Sangeeta', 'Priya',
  'Rekha', 'Meena', 'Geeta', 'Asha', 'Usha', 'Seema', 'Nisha', 'Ritu',
  'Manju', 'Shanti', 'Vandana', 'Archana', 'Pooja',
];

const INDIAN_LAST_NAMES_MAHARASHTRA = [
  'Patil', 'Jadhav', 'Shinde', 'Deshmukh', 'More', 'Pawar', 'Kadam',
  'Bhosale', 'Salve', 'Gaikwad', 'Kulkarni', 'Deshpande', 'Joshi',
  'Phadke', 'Gokhale', 'Sathe', 'Mane', 'Waghmare', 'Gavhane', 'Dhule',
];

const EMPLOYER_NAMES = [
  'Tata Consultancy Services', 'Infosys', 'Wipro', 'Tech Mahindra',
  'Bajaj Finserv', 'HDFC Bank', 'Bank of Maharashtra', 'Pune Municipal Corporation',
  'Maharashtra State Electricity Board', 'Kirloskar Electric',
  'Thermax Ltd', 'Cummins India', 'Force Motors', 'Bharat Forge',
  'Finolex Industries', 'Godrej & Boyce', 'Volkswagen India',
  'Sandvik Asia', 'Atlas Copco', 'Snap-on Tools',
];

// ────────────────────────────────────────────────────────────────────────────
// MAIN SEED FUNCTION
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Starting ORG2 seed (QuickCash NBFC)...');

  // ── 1. Organization ────────────────────────────────────────────────────
  console.log('Creating organization...');
  const org = await prisma.organization.create({
    data: {
      name: 'QuickCash NBFC',
      code: 'QCASH',
      licenseType: 'NBFC_MFI',
      rbiRegistrationNumber: 'N-02.00002',
      cinNumber: 'U65100MH2021PLC098765',
      address: '7th Floor, ICC Trade Tower, Senapati Bapat Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411016',
      isActive: true,
      settings: {},
    },
  });
  console.log(`  Organization created: ${org.name}`);

  // ── 2. Branches ────────────────────────────────────────────────────────
  console.log('Creating branches...');
  const branchHO = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: 'Head Office Pune',
      code: 'HO-PUNE',
      branchType: 'HEAD_OFFICE',
      address: '7th Floor, ICC Trade Tower, Senapati Bapat Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411016',
      latitude: 18.5204,
      longitude: 73.8567,
      isActive: true,
    },
  });

  const branchNSK = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: 'Branch Nashik',
      code: 'BR-NSK',
      branchType: 'BRANCH',
      address: '12, College Road, Nashik',
      city: 'Nashik',
      state: 'Maharashtra',
      pincode: '422005',
      latitude: 19.9975,
      longitude: 73.7898,
      isActive: true,
    },
  });
  console.log('  2 branches created');

  // ── 3. Users ────────────────────────────────────────────────────────────
  console.log('Creating users...');
  const passwordHash = await bcrypt.hash('Test@1234', 10);

  const userData = [
    {
      firstName: 'Suresh',
      lastName: 'Patil',
      email: 'suresh.patil@quickcash.in',
      phone: '9823456780',
      employeeCode: 'QC001',
      designation: 'Administrator',
      branchId: branchHO.id,
    },
    {
      firstName: 'Mahesh',
      lastName: 'Jadhav',
      email: 'mahesh.jadhav@quickcash.in',
      phone: '9823456781',
      employeeCode: 'QC002',
      designation: 'Branch Manager',
      branchId: branchNSK.id,
    },
    {
      firstName: 'Ganesh',
      lastName: 'Shinde',
      email: 'ganesh.shinde@quickcash.in',
      phone: '9823456782',
      employeeCode: 'QC003',
      designation: 'Credit Officer',
      branchId: branchHO.id,
    },
    {
      firstName: 'Sunita',
      lastName: 'Deshmukh',
      email: 'sunita.deshmukh@quickcash.in',
      phone: '9823456783',
      employeeCode: 'QC004',
      designation: 'Credit Officer',
      branchId: branchNSK.id,
    },
    {
      firstName: 'Kavita',
      lastName: 'More',
      email: 'kavita.more@quickcash.in',
      phone: '9823456784',
      employeeCode: 'QC005',
      designation: 'Collection Agent',
      branchId: branchHO.id,
    },
  ];

  const users: Awaited<ReturnType<typeof prisma.user.create>>[] = [];
  for (const u of userData) {
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        branchId: u.branchId,
        email: u.email,
        phone: u.phone,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash,
        employeeCode: u.employeeCode,
        designation: u.designation,
        isActive: true,
      },
    });
    users.push(user);
  }
  console.log(`  ${users.length} users created`);

  const [adminUser, branchMgr, creditOff1, creditOff2, collAgent] = users;

  // Update branch manager
  await prisma.branch.update({ where: { id: branchNSK.id }, data: { managerId: branchMgr.id } });

  // ── 4. Roles ────────────────────────────────────────────────────────────
  console.log('Creating roles...');

  const roleDefinitions = [
    {
      name: 'Admin',
      code: 'QCASH_ADMIN',
      permissions: [
        'org:read', 'org:write',
        'branch:read', 'branch:write',
        'user:read', 'user:write', 'user:delete',
        'role:read', 'role:write',
        'customer:read', 'customer:write', 'customer:delete',
        'loan_product:read', 'loan_product:write',
        'loan_application:read', 'loan_application:write', 'loan_application:delete',
        'loan:read', 'loan:write',
        'payment:read', 'payment:write',
        'bureau:read', 'bureau:write',
        'bre:read', 'bre:write',
        'collection:read', 'collection:write',
        'dsa:read', 'dsa:write',
        'gl:read', 'gl:write',
        'report:read',
        'audit:read',
      ],
    },
    {
      name: 'Branch Manager',
      code: 'QCASH_BRANCH_MANAGER',
      permissions: [
        'branch:read',
        'user:read',
        'customer:read', 'customer:write',
        'loan_product:read',
        'loan_application:read', 'loan_application:write',
        'loan:read', 'loan:write',
        'payment:read',
        'bureau:read',
        'bre:read',
        'collection:read', 'collection:write',
        'dsa:read',
        'gl:read',
        'report:read',
      ],
    },
    {
      name: 'Credit Officer',
      code: 'QCASH_CREDIT_OFFICER',
      permissions: [
        'customer:read', 'customer:write',
        'loan_product:read',
        'loan_application:read', 'loan_application:write',
        'loan:read',
        'bureau:read', 'bureau:write',
        'bre:read',
        'dsa:read',
      ],
    },
    {
      name: 'Collection Agent',
      code: 'QCASH_COLLECTION_AGENT',
      permissions: [
        'customer:read',
        'loan:read',
        'payment:read', 'payment:write',
        'collection:read', 'collection:write',
      ],
    },
    {
      name: 'Viewer',
      code: 'QCASH_VIEWER',
      permissions: [
        'customer:read',
        'loan_application:read',
        'loan:read',
        'report:read',
      ],
    },
  ];

  const roles: Record<string, Awaited<ReturnType<typeof prisma.role.create>>> = {};
  for (const rd of roleDefinitions) {
    const role = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: rd.name,
        code: rd.code,
        permissions: rd.permissions,
        isSystemRole: true,
      },
    });
    roles[rd.code] = role;
  }
  console.log(`  ${roleDefinitions.length} roles created`);

  // ── 5. UserRole Assignments ─────────────────────────────────────────────
  console.log('Creating user role assignments...');
  const userRoleAssignments = [
    { user: adminUser, roleCode: 'QCASH_ADMIN' },
    { user: branchMgr, roleCode: 'QCASH_BRANCH_MANAGER' },
    { user: creditOff1, roleCode: 'QCASH_CREDIT_OFFICER' },
    { user: creditOff2, roleCode: 'QCASH_CREDIT_OFFICER' },
    { user: collAgent, roleCode: 'QCASH_COLLECTION_AGENT' },
  ];

  for (const ura of userRoleAssignments) {
    await prisma.userRole.create({
      data: {
        userId: ura.user.id,
        roleId: roles[ura.roleCode].id,
      },
    });
  }
  console.log('  User roles assigned');

  // ── 6. Loan Products ────────────────────────────────────────────────────
  console.log('Creating loan products...');
  const productDefs = [
    {
      name: 'Microfinance',
      code: 'QCASH_MF',
      productType: 'MICROFINANCE' as const,
      minAmountPaisa: 500000,      // 5,000
      maxAmountPaisa: 5000000,     // 50,000
      minTenureMonths: 12,
      maxTenureMonths: 24,
      minInterestRateBps: 2000,
      maxInterestRateBps: 2600,
      processingFeePercent: new Decimal('1.00'),
      isSecured: false,
    },
    {
      name: 'Personal Loan',
      code: 'QCASH_PL',
      productType: 'PERSONAL_LOAN' as const,
      minAmountPaisa: 5000000,     // 50,000
      maxAmountPaisa: 30000000,    // 3,00,000
      minTenureMonths: 12,
      maxTenureMonths: 36,
      minInterestRateBps: 1800,
      maxInterestRateBps: 2400,
      processingFeePercent: new Decimal('2.00'),
      isSecured: false,
    },
  ];

  const products: Record<string, Awaited<ReturnType<typeof prisma.loanProduct.create>>> = {};
  for (const pd of productDefs) {
    const product = await prisma.loanProduct.create({
      data: {
        organizationId: org.id,
        name: pd.name,
        code: pd.code,
        productType: pd.productType,
        minAmountPaisa: pd.minAmountPaisa,
        maxAmountPaisa: pd.maxAmountPaisa,
        minTenureMonths: pd.minTenureMonths,
        maxTenureMonths: pd.maxTenureMonths,
        minInterestRateBps: pd.minInterestRateBps,
        maxInterestRateBps: pd.maxInterestRateBps,
        processingFeePercent: pd.processingFeePercent,
        isSecured: pd.isSecured,
        isActive: true,
        settings: {},
      },
    });
    products[pd.code] = product;
  }
  console.log(`  ${productDefs.length} loan products created`);

  // ── 7. Customers ────────────────────────────────────────────────────────
  console.log('Creating customers...');

  const empDistribution: ('SALARIED' | 'SELF_EMPLOYED_BUSINESS' | 'HOMEMAKER' | 'SELF_EMPLOYED_PROFESSIONAL')[] = [
    ...Array(8).fill('SALARIED'),
    ...Array(6).fill('SELF_EMPLOYED_BUSINESS'),
    ...Array(4).fill('HOMEMAKER'),
    ...Array(2).fill('SELF_EMPLOYED_PROFESSIONAL'),
  ];

  const customers: Awaited<ReturnType<typeof prisma.customer.create>>[] = [];
  for (let i = 0; i < 20; i++) {
    const isMale = i % 3 !== 0; // Mix of genders
    const firstName = isMale
      ? faker.helpers.arrayElement(INDIAN_FIRST_NAMES_MALE)
      : faker.helpers.arrayElement(INDIAN_FIRST_NAMES_FEMALE);
    const lastName = faker.helpers.arrayElement(INDIAN_LAST_NAMES_MAHARASHTRA);
    const fullName = `${firstName} ${lastName}`;
    const addr = randomIndianAddress();
    const empType = empDistribution[i % empDistribution.length];
    const dob = faker.date.birthdate({ min: 22, max: 55, mode: 'age' });
    const isVerified = i < 16; // 16 verified, 4 pending

    const groupNames = ['Sahyog', 'Vikas', 'Pragati', 'Shakti', 'Unnati'];
    const centerNames = ['Center A - Pune', 'Center B - Nashik', 'Center C - Hadapsar', 'Center D - Pimpri', 'Center E - Nashik'];

    const customer = await prisma.customer.create({
      data: {
        organizationId: org.id,
        customerNumber: `QCASH/CUST/${pad(i + 1, 6)}`,
        customerType: 'INDIVIDUAL',
        firstName,
        lastName,
        fullName,
        dateOfBirth: dob,
        gender: isMale ? 'MALE' : 'FEMALE',
        panNumber: randomPAN(),
        aadhaarNumber: randomAadhaar(),
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@gmail.com`,
        phone: randomIndianPhone(),
        alternatePhone: faker.datatype.boolean() ? randomIndianPhone() : null,
        currentAddressLine1: addr.line1,
        currentCity: addr.city,
        currentState: addr.state,
        currentPincode: addr.pincode,
        permanentAddressLine1: addr.line1,
        permanentCity: addr.city,
        permanentState: addr.state,
        permanentPincode: addr.pincode,
        employmentType: empType,
        employerName: empType === 'SALARIED'
          ? faker.helpers.arrayElement(EMPLOYER_NAMES)
          : empType === 'SELF_EMPLOYED_PROFESSIONAL'
            ? `${firstName} & Associates`
            : empType === 'SELF_EMPLOYED_BUSINESS'
              ? `${lastName} Enterprises`
              : null,
        monthlyIncomePaisa: faker.number.int({ min: 800000, max: 5000000 }), // 8K - 50K
        kycStatus: isVerified ? 'VERIFIED' : 'PENDING',
        riskCategory: isVerified
          ? faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH'] as const)
          : null,
        customFields: {
          group_name: groupNames[i % groupNames.length],
          center_name: centerNames[i % centerNames.length],
        },
      },
    });
    customers.push(customer);
  }
  console.log(`  ${customers.length} customers created`);

  // ── 8. DSAs ─────────────────────────────────────────────────────────────
  console.log('Creating DSAs...');
  const dsas: Awaited<ReturnType<typeof prisma.dSA.create>>[] = [];
  const dsaTypeDistribution: ('INDIVIDUAL' | 'AGENCY')[] = [
    ...Array(3).fill('INDIVIDUAL'),
    ...Array(2).fill('AGENCY'),
  ];

  for (let i = 0; i < 5; i++) {
    const dsaType = dsaTypeDistribution[i];
    const firstName = faker.helpers.arrayElement(INDIAN_FIRST_NAMES_MALE);
    const lastName = faker.helpers.arrayElement(INDIAN_LAST_NAMES_MAHARASHTRA);
    const name = dsaType === 'INDIVIDUAL'
      ? `${firstName} ${lastName}`
      : `${lastName} Financial Services`;

    const dsa = await prisma.dSA.create({
      data: {
        organizationId: org.id,
        name,
        contactPerson: `${firstName} ${lastName}`,
        phone: randomIndianPhone(),
        email: `qcdsa${pad(i + 1, 3)}@partner.in`,
        panNumber: randomPAN(),
        dsaCode: `QCDSA${pad(i + 1, 3)}`,
        dsaType,
        commissionPercent: new Decimal(
          (faker.number.float({ min: 0.5, max: 1.5, fractionDigits: 2 })).toFixed(2),
        ),
        products: ['QCASH_MF', 'QCASH_PL'],
        isActive: true,
        empanelmentDate: faker.date.past({ years: 2 }),
      },
    });
    dsas.push(dsa);
  }
  console.log(`  ${dsas.length} DSAs created`);

  // ── 9. BRE Rules for Microfinance Product ───────────────────────────────
  console.log('Creating BRE rules for MF product...');
  const mfProduct = products['QCASH_MF'];
  const effectiveFrom = new Date('2024-01-01');

  const breRulesData = [
    // ELIGIBILITY rules
    {
      name: 'Age Eligibility MF',
      description: 'Applicant must be between 18 and 60 years of age',
      category: 'ELIGIBILITY' as const,
      priority: 1,
      condition: { field: 'applicant.age', operator: 'BETWEEN', value: [18, 60] },
      action: 'REJECT' as const,
      reason: 'Applicant age is outside MFI eligible range of 18-60 years',
    },
    {
      name: 'KYC Status Check MF',
      description: 'Applicant KYC must be verified',
      category: 'ELIGIBILITY' as const,
      priority: 2,
      condition: { field: 'applicant.kycStatus', operator: 'EQ', value: 'VERIFIED' },
      action: 'REJECT' as const,
      reason: 'Applicant KYC is not verified',
    },
    // POLICY rules
    {
      name: 'Minimum CIBIL Score MF',
      description: 'Bureau score must be at least 550 (simpler MFI threshold)',
      category: 'POLICY' as const,
      priority: 10,
      condition: { field: 'bureau.score', operator: 'GTE', value: 550 },
      action: 'REJECT' as const,
      reason: 'Bureau score is below MFI minimum threshold of 550',
    },
    {
      name: 'No Active NPA MF',
      description: 'Applicant must not have any active NPA account',
      category: 'POLICY' as const,
      priority: 11,
      condition: { field: 'bureau.hasWriteOff', operator: 'EQ', value: false },
      action: 'REJECT' as const,
      reason: 'Applicant has a write-off record - ineligible for microfinance',
    },
    {
      name: 'Max Active MFI Loans',
      description: 'Applicant must not have more than 2 active MFI loans',
      category: 'POLICY' as const,
      priority: 12,
      condition: { field: 'bureau.totalActiveLoans', operator: 'LTE', value: 2 },
      action: 'REJECT' as const,
      reason: 'Applicant has more than 2 active loans (MFI indebtedness limit)',
    },
    // PRICING rules
    {
      name: 'Pricing - Good Score (650+)',
      description: 'Lower rate for scores 650 and above',
      category: 'PRICING' as const,
      priority: 20,
      condition: { field: 'bureau.score', operator: 'GTE', value: 650 },
      action: 'APPROVE' as const,
      reason: 'Good bureau score - offering lower MFI rate',
      outputRate: 2000,
    },
    {
      name: 'Pricing - Fair Score (550-649)',
      description: 'Standard MFI rate for scores between 550 and 649',
      category: 'PRICING' as const,
      priority: 21,
      condition: { field: 'bureau.score', operator: 'BETWEEN', value: [550, 649] },
      action: 'APPROVE' as const,
      reason: 'Fair bureau score - standard MFI rate applied',
      outputRate: 2400,
    },
  ];

  for (const rule of breRulesData) {
    const conditionData = (rule as any).outputRate !== undefined
      ? { ...rule.condition, outputInterestRateBps: (rule as any).outputRate }
      : rule.condition;

    await prisma.breRule.create({
      data: {
        organizationId: org.id,
        productId: mfProduct.id,
        name: rule.name,
        description: rule.description,
        category: rule.category,
        priority: rule.priority,
        condition: conditionData,
        action: rule.action,
        reason: rule.reason,
        isActive: true,
        effectiveFrom,
        version: 1,
      },
    });
  }
  console.log(`  ${breRulesData.length} BRE rules created for MF product`);

  // ── 10. Loan Applications ───────────────────────────────────────────────
  console.log('Creating loan applications...');

  const appStatuses = [
    'LEAD', 'LEAD',
    'BUREAU_CHECK',
    'UNDERWRITING', 'UNDERWRITING',
    'SANCTIONED',
    'DISBURSED', 'DISBURSED', 'DISBURSED',
    'REJECTED',
  ];

  const branches = [branchHO, branchNSK];
  const productCodes = Object.keys(products);
  const loanApplications: Awaited<ReturnType<typeof prisma.loanApplication.create>>[] = [];

  for (let i = 0; i < 10; i++) {
    const status = appStatuses[i];
    const customer = customers[i];
    const productCode = productCodes[i % productCodes.length];
    const product = products[productCode];
    const branch = branches[i % branches.length];
    const creditOfficer = i % 2 === 0 ? creditOff1 : creditOff2;
    const dsa = i % 3 === 0 ? dsas[i % dsas.length] : null;

    const requestedAmount = faker.number.int({
      min: product.minAmountPaisa,
      max: product.maxAmountPaisa,
    });
    const requestedTenure = faker.number.int({
      min: product.minTenureMonths,
      max: product.maxTenureMonths,
    });

    const isSanctioned = ['SANCTIONED', 'DISBURSED'].includes(status);
    const isRejected = status === 'REJECTED';

    const appData: Parameters<typeof prisma.loanApplication.create>[0]['data'] = {
      organizationId: org.id,
      branchId: branch.id,
      applicationNumber: `QCASH/${productCode}/2025/${pad(i + 1, 6)}`,
      customerId: customer.id,
      productId: product.id,
      requestedAmountPaisa: requestedAmount,
      requestedTenureMonths: requestedTenure,
      status: status as any,
      sourceType: dsa ? 'DSA' : faker.helpers.arrayElement(['BRANCH', 'WALKIN']) as any,
      dsaId: dsa ? dsa.id : null,
      assignedToId: creditOfficer.id,
      sanctionedAmountPaisa: isSanctioned ? Math.floor(requestedAmount * 0.95) : null,
      sanctionedTenureMonths: isSanctioned ? requestedTenure : null,
      sanctionedInterestRateBps: isSanctioned
        ? faker.number.int({ min: product.minInterestRateBps, max: product.maxInterestRateBps })
        : null,
      rejectionReason: isRejected ? 'Bureau score below MFI minimum threshold of 550' : null,
    };

    const app = await prisma.loanApplication.create({ data: appData });
    loanApplications.push(app);
  }
  console.log(`  ${loanApplications.length} loan applications created`);

  // ── 11. Active Loans with EMI Schedules ─────────────────────────────────
  console.log('Creating loans and EMI schedules...');

  // Use DISBURSED applications (3) + create 2 more
  const disbursedApps = loanApplications.filter((a) => a.status === 'DISBURSED');

  // Create 2 more applications for additional loans
  const extraLoanApps: Awaited<ReturnType<typeof prisma.loanApplication.create>>[] = [];
  for (let i = 0; i < 2; i++) {
    const customer = customers[10 + i];
    const productCode = productCodes[i % productCodes.length];
    const product = products[productCode];
    const branch = branches[i % branches.length];
    const creditOfficer = i % 2 === 0 ? creditOff1 : creditOff2;

    const requestedAmount = faker.number.int({
      min: product.minAmountPaisa,
      max: product.maxAmountPaisa,
    });
    const requestedTenure = faker.number.int({
      min: product.minTenureMonths,
      max: product.maxTenureMonths,
    });
    const rate = faker.number.int({
      min: product.minInterestRateBps,
      max: product.maxInterestRateBps,
    });

    const extraApp = await prisma.loanApplication.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        applicationNumber: `QCASH/${productCode}/2025/${pad(11 + i, 6)}`,
        customerId: customer.id,
        productId: product.id,
        requestedAmountPaisa: requestedAmount,
        requestedTenureMonths: requestedTenure,
        status: 'DISBURSED',
        sourceType: 'BRANCH',
        assignedToId: creditOfficer.id,
        sanctionedAmountPaisa: Math.floor(requestedAmount * 0.95),
        sanctionedTenureMonths: requestedTenure,
        sanctionedInterestRateBps: rate,
      },
    });
    extraLoanApps.push(extraApp);
  }

  const allLoanApps = [...disbursedApps, ...extraLoanApps];

  const loanScenarios = [
    { dpd: 0, npa: 'STANDARD' as const },
    { dpd: 0, npa: 'STANDARD' as const },
    { dpd: 0, npa: 'STANDARD' as const },
    { dpd: 12, npa: 'SMA_0' as const },
    { dpd: 45, npa: 'SMA_1' as const },
  ];

  const loans: Awaited<ReturnType<typeof prisma.loan.create>>[] = [];
  for (let i = 0; i < 5; i++) {
    const app = allLoanApps[i];
    const scenario = loanScenarios[i];
    const productCode = productCodes[i % productCodes.length];
    const product = products[productCode];
    const branch = branches[i % branches.length];
    const customer = customers[i < 3 ? 6 + i : 10 + (i - 3)];

    const monthsAgo = faker.number.int({ min: 3, max: 12 });
    const disbursementDate = new Date();
    disbursementDate.setMonth(disbursementDate.getMonth() - monthsAgo);
    disbursementDate.setDate(1);

    const principalPaisa = app.sanctionedAmountPaisa ?? faker.number.int({
      min: product.minAmountPaisa,
      max: product.maxAmountPaisa,
    });
    const tenureMonths = app.sanctionedTenureMonths ?? product.minTenureMonths;
    const rateBps = app.sanctionedInterestRateBps ?? product.minInterestRateBps;

    const emiPaisa = calculateEMI(principalPaisa, rateBps, tenureMonths);
    const totalInterestPaisa = emiPaisa * tenureMonths - principalPaisa;

    const maturityDate = new Date(disbursementDate);
    maturityDate.setMonth(maturityDate.getMonth() + tenureMonths);

    const emisPaid = Math.max(0, monthsAgo - 1);
    const outstandingPrincipal = Math.max(
      0,
      principalPaisa - Math.floor((principalPaisa / tenureMonths) * emisPaid),
    );

    const loan = await prisma.loan.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        loanNumber: `QCASH/LN/2025/${pad(i + 1, 6)}`,
        applicationId: app.id,
        customerId: customer.id,
        productId: product.id,
        disbursedAmountPaisa: principalPaisa,
        disbursementDate,
        interestRateBps: rateBps,
        tenureMonths,
        emiAmountPaisa: emiPaisa,
        totalInterestPaisa: Math.max(0, totalInterestPaisa),
        outstandingPrincipalPaisa: outstandingPrincipal,
        outstandingInterestPaisa: scenario.dpd > 0
          ? Math.floor(emiPaisa * Math.ceil(scenario.dpd / 30) * 0.15)
          : 0,
        totalOverduePaisa: scenario.dpd > 0
          ? Math.floor(emiPaisa * Math.ceil(scenario.dpd / 30))
          : 0,
        dpd: scenario.dpd,
        npaClassification: scenario.npa,
        loanStatus: 'ACTIVE',
        maturityDate,
      },
    });
    loans.push(loan);

    // Build and create EMI schedule
    const schedule = buildAmortizationSchedule(principalPaisa, rateBps, tenureMonths, disbursementDate);

    const today = new Date();
    for (const sched of schedule) {
      const isPast = sched.dueDate < today;
      const installmentMonthsAgo = Math.floor(
        (today.getTime() - sched.dueDate.getTime()) / (1000 * 60 * 60 * 24 * 30),
      );

      let schedStatus: 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIALLY_PAID' = 'PENDING';
      let paidAmount = 0;
      let paidPrincipal = 0;
      let paidInterest = 0;
      let paidDate: Date | null = null;

      if (isPast) {
        if (scenario.dpd === 0) {
          schedStatus = 'PAID';
          paidAmount = sched.emiAmountPaisa;
          paidPrincipal = sched.principalComponentPaisa;
          paidInterest = sched.interestComponentPaisa;
          paidDate = new Date(sched.dueDate);
          paidDate.setDate(paidDate.getDate() + faker.number.int({ min: 0, max: 3 }));
        } else if (scenario.dpd <= 30) {
          if (installmentMonthsAgo >= 1) {
            schedStatus = 'PAID';
            paidAmount = sched.emiAmountPaisa;
            paidPrincipal = sched.principalComponentPaisa;
            paidInterest = sched.interestComponentPaisa;
            paidDate = new Date(sched.dueDate);
          } else {
            schedStatus = 'OVERDUE';
          }
        } else {
          if (installmentMonthsAgo >= 2) {
            schedStatus = 'PAID';
            paidAmount = sched.emiAmountPaisa;
            paidPrincipal = sched.principalComponentPaisa;
            paidInterest = sched.interestComponentPaisa;
            paidDate = new Date(sched.dueDate);
          } else {
            schedStatus = 'OVERDUE';
          }
        }
      }

      await prisma.loanSchedule.create({
        data: {
          loanId: loan.id,
          installmentNumber: sched.installmentNumber,
          dueDate: sched.dueDate,
          emiAmountPaisa: sched.emiAmountPaisa,
          principalComponentPaisa: sched.principalComponentPaisa,
          interestComponentPaisa: sched.interestComponentPaisa,
          openingBalancePaisa: sched.openingBalancePaisa,
          closingBalancePaisa: sched.closingBalancePaisa,
          paidAmountPaisa: paidAmount,
          paidDate,
          paidPrincipalPaisa: paidPrincipal,
          paidInterestPaisa: paidInterest,
          penalInterestPaisa: schedStatus === 'OVERDUE' && scenario.dpd > 30
            ? Math.floor(sched.interestComponentPaisa * 0.02 * scenario.dpd)
            : 0,
          status: schedStatus,
        },
      });
    }

    // Create collection tasks for overdue loans
    if (scenario.dpd > 0) {
      const taskType = scenario.dpd <= 30 ? 'TELECALL' : 'FIELD_VISIT';
      await prisma.collectionTask.create({
        data: {
          organizationId: org.id,
          loanId: loan.id,
          dpdAtCreation: scenario.dpd,
          taskType: taskType as any,
          assignedToId: collAgent.id,
          scheduledDate: new Date(),
          status: 'PENDING',
          disposition: 'NO_DISPOSITION',
          remarks: `DPD ${scenario.dpd} - MFI follow up required`,
        },
      });
    }
  }
  console.log(`  ${loans.length} loans created with EMI schedules`);

  // ── 12. Collection Strategies ────────────────────────────────────────────
  console.log('Creating collection strategies...');

  const collectionStrategies = [
    {
      name: 'Early DPD Strategy (1-15)',
      dpdFrom: 1,
      dpdTo: 15,
      actions: [
        { dayOffset: 1, taskType: 'SMS', channel: 'SMS', template: 'EMI_REMINDER' },
        { dayOffset: 5, taskType: 'TELECALL', channel: 'PHONE', template: 'SOFT_REMINDER' },
        { dayOffset: 10, taskType: 'FIELD_VISIT', template: 'FIELD_COLLECTION' },
      ],
    },
    {
      name: 'Mid DPD Strategy (16-30)',
      dpdFrom: 16,
      dpdTo: 30,
      actions: [
        { dayOffset: 1, taskType: 'TELECALL', channel: 'PHONE', template: 'FIRM_REMINDER' },
        { dayOffset: 5, taskType: 'FIELD_VISIT', template: 'FIELD_COLLECTION' },
        { dayOffset: 15, taskType: 'FIELD_VISIT', template: 'GROUP_MEETING' },
      ],
    },
    {
      name: 'High DPD Strategy (31-60)',
      dpdFrom: 31,
      dpdTo: 60,
      actions: [
        { dayOffset: 1, taskType: 'AGENCY_ALLOCATION', template: 'LEGAL_WARNING' },
        { dayOffset: 10, taskType: 'FIELD_VISIT', template: 'LEGAL_FIELD_VISIT' },
      ],
    },
  ];

  for (const strategy of collectionStrategies) {
    await prisma.collectionStrategy.create({
      data: {
        organizationId: org.id,
        name: strategy.name,
        dpdFrom: strategy.dpdFrom,
        dpdTo: strategy.dpdTo,
        actions: strategy.actions,
        isActive: true,
      },
    });
  }
  console.log(`  ${collectionStrategies.length} collection strategies created`);

  // ── 13. GL Accounts ─────────────────────────────────────────────────────
  console.log('Creating GL accounts...');

  const glAccountDefs = [
    { accountCode: '1000', accountName: 'MFI Loan Assets', accountType: 'ASSET', parentCode: null },
    { accountCode: '1100', accountName: 'Accrued Interest Receivable', accountType: 'ASSET', parentCode: '1000' },
    { accountCode: '1200', accountName: 'Provision for NPA', accountType: 'ASSET', parentCode: '1000' },
    { accountCode: '2000', accountName: 'Bank Account - Current', accountType: 'ASSET', parentCode: null },
    { accountCode: '2100', accountName: 'Cash in Hand', accountType: 'ASSET', parentCode: null },
    { accountCode: '3000', accountName: 'Borrowings - Bank', accountType: 'LIABILITY', parentCode: null },
    { accountCode: '3100', accountName: 'Interest Payable', accountType: 'LIABILITY', parentCode: '3000' },
    { accountCode: '4000', accountName: 'Interest Income - MFI', accountType: 'INCOME', parentCode: null },
    { accountCode: '4100', accountName: 'Processing Fee Income', accountType: 'INCOME', parentCode: null },
    { accountCode: '4200', accountName: 'Penal Interest Income', accountType: 'INCOME', parentCode: null },
    { accountCode: '5000', accountName: 'Interest Expense', accountType: 'EXPENSE', parentCode: null },
    { accountCode: '5100', accountName: 'Provision Expense', accountType: 'EXPENSE', parentCode: null },
    { accountCode: '5200', accountName: 'Write-off Expense', accountType: 'EXPENSE', parentCode: null },
    { accountCode: '6000', accountName: 'Share Capital', accountType: 'EQUITY', parentCode: null },
    { accountCode: '6100', accountName: 'Retained Earnings', accountType: 'EQUITY', parentCode: null },
  ];

  for (const account of glAccountDefs) {
    await prisma.glAccount.create({
      data: {
        organizationId: org.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        parentCode: account.parentCode,
        isActive: true,
      },
    });
  }
  console.log(`  ${glAccountDefs.length} GL accounts created`);

  // ── 14. Custom Field Definitions ─────────────────────────────────────────
  console.log('Creating custom field definitions...');

  const customFieldDefs = [
    // Customer fields
    {
      entityType: 'CUSTOMER',
      fieldKey: 'group_name',
      fieldLabel: 'Group Name',
      fieldType: 'STRING',
      isRequired: true,
      isSearchable: true,
      isVisibleInList: true,
      displayOrder: 1,
      sectionName: 'MFI Group Details',
    },
    {
      entityType: 'CUSTOMER',
      fieldKey: 'center_name',
      fieldLabel: 'Center Name',
      fieldType: 'STRING',
      isRequired: true,
      isSearchable: true,
      isVisibleInList: true,
      displayOrder: 2,
      sectionName: 'MFI Group Details',
    },
    // LoanApplication field
    {
      entityType: 'LOAN_APPLICATION',
      fieldKey: 'group_leader_name',
      fieldLabel: 'Group Leader Name',
      fieldType: 'STRING',
      isRequired: false,
      isSearchable: false,
      isVisibleInList: false,
      displayOrder: 1,
      sectionName: 'Group Details',
    },
  ];

  for (const fieldDef of customFieldDefs) {
    await prisma.customFieldDefinition.create({
      data: {
        organizationId: org.id,
        entityType: fieldDef.entityType,
        fieldKey: fieldDef.fieldKey,
        fieldLabel: fieldDef.fieldLabel,
        fieldType: fieldDef.fieldType,
        isRequired: fieldDef.isRequired,
        isSearchable: fieldDef.isSearchable,
        isVisibleInList: fieldDef.isVisibleInList,
        displayOrder: fieldDef.displayOrder,
        sectionName: fieldDef.sectionName,
        isActive: true,
      },
    });
  }
  console.log(`  ${customFieldDefs.length} custom field definitions created`);

  console.log('\nORG2 Seed completed successfully!');
  console.log('Summary:');
  console.log('  1 Organization (QuickCash NBFC)');
  console.log('  2 Branches');
  console.log('  5 Users');
  console.log('  5 Roles');
  console.log('  2 Loan Products');
  console.log('  20 Customers');
  console.log('  5 DSAs');
  console.log(`  ${breRulesData.length} BRE Rules (MF product)`);
  console.log('  12 Loan Applications');
  console.log('  5 Active Loans with EMI schedules');
  console.log('  3 Collection Strategies');
  console.log('  15 GL Accounts');
  console.log('  3 Custom Field Definitions');
}

main()
  .catch((e) => {
    console.error('ORG2 Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
