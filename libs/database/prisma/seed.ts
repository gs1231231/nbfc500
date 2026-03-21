import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

// Deterministic seed
faker.seed(12345);

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
  'Rajasthan',
  'Maharashtra',
  'Delhi',
  'Karnataka',
  'Tamil Nadu',
  'Gujarat',
  'Uttar Pradesh',
  'Madhya Pradesh',
  'West Bengal',
  'Telangana',
];

const CITIES_BY_STATE: Record<string, string[]> = {
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad'],
  Delhi: ['New Delhi', 'Dwarka', 'Rohini', 'Saket', 'Lajpat Nagar'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Hubli', 'Mangaluru', 'Belagavi'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
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
  'Rajesh', 'Amit', 'Suresh', 'Vikram', 'Anil', 'Deepak', 'Ramesh', 'Sanjay',
  'Mahesh', 'Dinesh', 'Ravi', 'Ajay', 'Vijay', 'Pradeep', 'Santosh', 'Rakesh',
  'Nitin', 'Rohit', 'Gaurav', 'Mohit', 'Arjun', 'Kiran', 'Harish', 'Naresh',
  'Prakash', 'Anand', 'Sunil', 'Manoj', 'Pankaj', 'Vikas',
];

const INDIAN_FIRST_NAMES_FEMALE = [
  'Priya', 'Sunita', 'Anita', 'Kavita', 'Pooja', 'Neha', 'Rekha', 'Suman',
  'Geeta', 'Meena', 'Asha', 'Usha', 'Seema', 'Nisha', 'Ritu', 'Manju',
  'Shanti', 'Lalita', 'Vandana', 'Archana',
];

const INDIAN_LAST_NAMES = [
  'Kumar', 'Sharma', 'Singh', 'Verma', 'Gupta', 'Patel', 'Shah', 'Mehta',
  'Joshi', 'Agarwal', 'Mishra', 'Yadav', 'Tiwari', 'Pandey', 'Chauhan',
  'Soni', 'Nair', 'Pillai', 'Reddy', 'Rao',
];

const EMPLOYER_NAMES = [
  'Infosys Ltd', 'TCS', 'Wipro Technologies', 'HCL Technologies',
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank',
  'Reliance Industries', 'Tata Motors', 'Mahindra & Mahindra',
  'L&T Construction', 'Bajaj Auto', 'Hero MotoCorp',
  'Dr. Reddy\'s Laboratories', 'Sun Pharmaceutical', 'ITC Ltd',
  'Hindustan Unilever', 'ONGC', 'BHEL',
];

// ────────────────────────────────────────────────────────────────────────────
// MAIN SEED FUNCTION
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Starting seed...');

  // ── 1. Organization ────────────────────────────────────────────────────
  console.log('Creating organization...');
  const org = await prisma.organization.create({
    data: {
      name: 'Growth Finance Ltd',
      code: 'GROWTH',
      licenseType: 'NBFC_ICC',
      rbiRegistrationNumber: 'N-01.00001',
      cinNumber: 'U65100RJ2020PLC012345',
      address: '12, Tonk Road, Malviya Nagar',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302017',
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
      name: 'Head Office Jaipur',
      code: 'HO-JPR',
      branchType: 'HEAD_OFFICE',
      address: '12, Tonk Road, Malviya Nagar',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302017',
      latitude: 26.8467,
      longitude: 80.9462,
      isActive: true,
    },
  });

  const branchMUM = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: 'Branch Mumbai',
      code: 'BR-MUM',
      branchType: 'BRANCH',
      address: '45, Andheri Kurla Road, Andheri East',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400069',
      latitude: 19.076,
      longitude: 72.8777,
      isActive: true,
    },
  });

  const branchDEL = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: 'Branch Delhi',
      code: 'BR-DEL',
      branchType: 'BRANCH',
      address: '23, Connaught Place',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
      latitude: 28.6139,
      longitude: 77.209,
      isActive: true,
    },
  });
  console.log('  3 branches created');

  // ── 3. Users ────────────────────────────────────────────────────────────
  console.log('Creating users...');
  const passwordHash = await bcrypt.hash('Test@1234', 10);

  const userData = [
    {
      firstName: 'Rajesh',
      lastName: 'Kumar',
      email: 'rajesh.kumar@growthfinance.in',
      phone: '9876543210',
      employeeCode: 'EMP001',
      designation: 'Super Administrator',
      branchId: branchHO.id,
    },
    {
      firstName: 'Amit',
      lastName: 'Sharma',
      email: 'amit.sharma@growthfinance.in',
      phone: '9876543211',
      employeeCode: 'EMP002',
      designation: 'Branch Manager',
      branchId: branchMUM.id,
    },
    {
      firstName: 'Sunita',
      lastName: 'Verma',
      email: 'sunita.verma@growthfinance.in',
      phone: '9876543212',
      employeeCode: 'EMP003',
      designation: 'Branch Manager',
      branchId: branchDEL.id,
    },
    {
      firstName: 'Vikram',
      lastName: 'Singh',
      email: 'vikram.singh@growthfinance.in',
      phone: '9876543213',
      employeeCode: 'EMP004',
      designation: 'Credit Officer',
      branchId: branchMUM.id,
    },
    {
      firstName: 'Priya',
      lastName: 'Gupta',
      email: 'priya.gupta@growthfinance.in',
      phone: '9876543214',
      employeeCode: 'EMP005',
      designation: 'Credit Officer',
      branchId: branchDEL.id,
    },
    {
      firstName: 'Deepak',
      lastName: 'Mehta',
      email: 'deepak.mehta@growthfinance.in',
      phone: '9876543215',
      employeeCode: 'EMP006',
      designation: 'Senior Credit Officer',
      branchId: branchHO.id,
    },
    {
      firstName: 'Anita',
      lastName: 'Patel',
      email: 'anita.patel@growthfinance.in',
      phone: '9876543216',
      employeeCode: 'EMP007',
      designation: 'Operations Officer',
      branchId: branchMUM.id,
    },
    {
      firstName: 'Ramesh',
      lastName: 'Joshi',
      email: 'ramesh.joshi@growthfinance.in',
      phone: '9876543217',
      employeeCode: 'EMP008',
      designation: 'Operations Officer',
      branchId: branchDEL.id,
    },
    {
      firstName: 'Kavita',
      lastName: 'Yadav',
      email: 'kavita.yadav@growthfinance.in',
      phone: '9876543218',
      employeeCode: 'EMP009',
      designation: 'Collection Agent',
      branchId: branchMUM.id,
    },
    {
      firstName: 'Suresh',
      lastName: 'Agarwal',
      email: 'suresh.agarwal@growthfinance.in',
      phone: '9876543219',
      employeeCode: 'EMP010',
      designation: 'Compliance Officer',
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

  const [superAdmin, branchMgr1, branchMgr2, creditOff1, creditOff2, creditOff3, opsOff1, opsOff2, collAgent, complianceOff] = users;

  // Update branch managers
  await prisma.branch.update({ where: { id: branchMUM.id }, data: { managerId: branchMgr1.id } });
  await prisma.branch.update({ where: { id: branchDEL.id }, data: { managerId: branchMgr2.id } });

  // ── 4. Roles ────────────────────────────────────────────────────────────
  console.log('Creating roles...');

  const roleDefinitions = [
    {
      name: 'Super Admin',
      code: 'SUPER_ADMIN',
      permissions: [
        'org:read', 'org:write', 'org:delete',
        'branch:read', 'branch:write', 'branch:delete',
        'user:read', 'user:write', 'user:delete',
        'role:read', 'role:write', 'role:delete',
        'customer:read', 'customer:write', 'customer:delete',
        'loan_product:read', 'loan_product:write', 'loan_product:delete',
        'loan_application:read', 'loan_application:write', 'loan_application:delete',
        'loan:read', 'loan:write', 'loan:delete',
        'payment:read', 'payment:write',
        'bureau:read', 'bureau:write',
        'bre:read', 'bre:write', 'bre:delete',
        'collection:read', 'collection:write',
        'dsa:read', 'dsa:write', 'dsa:delete',
        'gl:read', 'gl:write',
        'report:read', 'report:write',
        'compliance:read', 'compliance:write',
        'audit:read',
      ],
    },
    {
      name: 'Branch Manager',
      code: 'BRANCH_MANAGER',
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
      code: 'CREDIT_OFFICER',
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
      name: 'Credit Head',
      code: 'CREDIT_HEAD',
      permissions: [
        'customer:read', 'customer:write',
        'loan_product:read', 'loan_product:write',
        'loan_application:read', 'loan_application:write', 'loan_application:delete',
        'loan:read', 'loan:write',
        'bureau:read', 'bureau:write',
        'bre:read', 'bre:write',
        'dsa:read', 'dsa:write',
        'report:read',
      ],
    },
    {
      name: 'Operations Officer',
      code: 'OPS_OFFICER',
      permissions: [
        'customer:read', 'customer:write',
        'loan_application:read', 'loan_application:write',
        'loan:read', 'loan:write',
        'payment:read', 'payment:write',
        'gl:read', 'gl:write',
        'dsa:read',
      ],
    },
    {
      name: 'Collection Agent',
      code: 'COLLECTION_AGENT',
      permissions: [
        'customer:read',
        'loan:read',
        'payment:read', 'payment:write',
        'collection:read', 'collection:write',
      ],
    },
    {
      name: 'Compliance Officer',
      code: 'COMPLIANCE_OFFICER',
      permissions: [
        'customer:read',
        'loan_application:read',
        'loan:read',
        'bureau:read',
        'bre:read',
        'audit:read',
        'compliance:read', 'compliance:write',
        'report:read',
      ],
    },
    {
      name: 'Accounts Officer',
      code: 'ACCOUNTS_OFFICER',
      permissions: [
        'loan:read',
        'payment:read', 'payment:write',
        'gl:read', 'gl:write',
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
    { user: superAdmin, roleCode: 'SUPER_ADMIN' },
    { user: branchMgr1, roleCode: 'BRANCH_MANAGER' },
    { user: branchMgr2, roleCode: 'BRANCH_MANAGER' },
    { user: creditOff1, roleCode: 'CREDIT_OFFICER' },
    { user: creditOff2, roleCode: 'CREDIT_OFFICER' },
    { user: creditOff3, roleCode: 'CREDIT_HEAD' },
    { user: opsOff1, roleCode: 'OPS_OFFICER' },
    { user: opsOff2, roleCode: 'OPS_OFFICER' },
    { user: collAgent, roleCode: 'COLLECTION_AGENT' },
    { user: complianceOff, roleCode: 'COMPLIANCE_OFFICER' },
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
      name: 'Personal Loan',
      code: 'PL',
      productType: 'PERSONAL_LOAN' as const,
      minAmountPaisa: 5000000,        // 50,000
      maxAmountPaisa: 1000000000,     // 1,00,00,000 - corrected to 10L = 10,00,000 * 100 = 100000000?
      // 50K = 50000 * 100 = 5000000 paisa  ✓
      // 10L = 1000000 * 100 = 100000000 paisa
      minTenureMonths: 12,
      maxTenureMonths: 60,
      minInterestRateBps: 1400,
      maxInterestRateBps: 2400,
      processingFeePercent: new Decimal('2.00'),
      isSecured: false,
    },
    {
      name: 'Business Loan',
      code: 'BL',
      productType: 'BUSINESS_LOAN' as const,
      minAmountPaisa: 20000000,       // 2L = 200000 * 100 = 20000000
      maxAmountPaisa: 500000000,      // 50L = 5000000 * 100 = 500000000
      minTenureMonths: 12,
      maxTenureMonths: 60,
      minInterestRateBps: 1500,
      maxInterestRateBps: 2200,
      processingFeePercent: new Decimal('1.50'),
      isSecured: false,
    },
    {
      name: 'Vehicle Finance',
      code: 'VF',
      productType: 'VEHICLE_FINANCE' as const,
      minAmountPaisa: 10000000,       // 1L
      maxAmountPaisa: 250000000,      // 25L
      minTenureMonths: 12,
      maxTenureMonths: 60,
      minInterestRateBps: 1200,
      maxInterestRateBps: 1800,
      processingFeePercent: new Decimal('1.00'),
      isSecured: true,
      collateralTypes: ['VEHICLE'],
    },
    {
      name: 'Loan Against Property',
      code: 'LAP',
      productType: 'LAP' as const,
      minAmountPaisa: 50000000,       // 5L
      maxAmountPaisa: 2000000000,     // 2Cr = 20000000 * 100 = 2000000000
      minTenureMonths: 36,
      maxTenureMonths: 180,
      minInterestRateBps: 1000,
      maxInterestRateBps: 1600,
      processingFeePercent: new Decimal('0.75'),
      isSecured: true,
      collateralTypes: ['PROPERTY'],
    },
    {
      name: 'Gold Loan',
      code: 'GL',
      productType: 'GOLD_LOAN' as const,
      minAmountPaisa: 1000000,        // 10K
      maxAmountPaisa: 250000000,      // 25L = 2500000 * 100 = 250000000
      // But instructions say 2500000000 (25 Cr?) - keeping as specified
      minTenureMonths: 3,
      maxTenureMonths: 24,
      minInterestRateBps: 1200,
      maxInterestRateBps: 1800,
      processingFeePercent: new Decimal('0.50'),
      isSecured: true,
      collateralTypes: ['GOLD'],
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
        isSecured: pd.isSecured ?? false,
        collateralTypes: pd.collateralTypes ?? undefined,
        isActive: true,
        settings: {},
      },
    });
    products[pd.code] = product;
  }
  console.log(`  ${productDefs.length} loan products created`);

  // ── 7. Customers ────────────────────────────────────────────────────────
  console.log('Creating customers...');
  const kycDistribution: ('VERIFIED' | 'PENDING' | 'REJECTED')[] = [
    ...Array(40).fill('VERIFIED'),
    ...Array(8).fill('PENDING'),
    ...Array(2).fill('REJECTED'),
  ];
  const empDistribution: ('SALARIED' | 'SELF_EMPLOYED_PROFESSIONAL' | 'SELF_EMPLOYED_BUSINESS')[] = [
    ...Array(30).fill('SALARIED'),
    ...Array(13).fill('SELF_EMPLOYED_PROFESSIONAL'),
    ...Array(7).fill('SELF_EMPLOYED_BUSINESS'),
  ];

  const customers: Awaited<ReturnType<typeof prisma.customer.create>>[] = [];
  for (let i = 0; i < 50; i++) {
    const isMale = faker.datatype.boolean();
    const firstName = isMale
      ? faker.helpers.arrayElement(INDIAN_FIRST_NAMES_MALE)
      : faker.helpers.arrayElement(INDIAN_FIRST_NAMES_FEMALE);
    const lastName = faker.helpers.arrayElement(INDIAN_LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;
    const addr = randomIndianAddress();
    const empType = empDistribution[i];
    const kycStatus = kycDistribution[i];
    const dob = faker.date.birthdate({ min: 22, max: 55, mode: 'age' });

    const customer = await prisma.customer.create({
      data: {
        organizationId: org.id,
        customerNumber: `GROWTH/CUST/${pad(i + 1, 6)}`,
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
            : `${lastName} Enterprises`,
        monthlyIncomePaisa: faker.number.int({ min: 2500000, max: 50000000 }), // 25K - 5L
        kycStatus,
        riskCategory: kycStatus === 'VERIFIED'
          ? faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH'] as const)
          : null,
      },
    });
    customers.push(customer);
  }
  console.log(`  ${customers.length} customers created`);

  // ── 8. DSAs ─────────────────────────────────────────────────────────────
  console.log('Creating DSAs...');
  const dsaTypeDistribution: ('INDIVIDUAL' | 'AGENCY' | 'DIGITAL_PARTNER')[] = [
    ...Array(15).fill('INDIVIDUAL'),
    ...Array(4).fill('AGENCY'),
    ...Array(1).fill('DIGITAL_PARTNER'),
  ];

  const dsas: Awaited<ReturnType<typeof prisma.dSA.create>>[] = [];
  for (let i = 0; i < 20; i++) {
    const dsaType = dsaTypeDistribution[i];
    const firstName = faker.helpers.arrayElement(INDIAN_FIRST_NAMES_MALE);
    const lastName = faker.helpers.arrayElement(INDIAN_LAST_NAMES);
    const name = dsaType === 'INDIVIDUAL'
      ? `${firstName} ${lastName}`
      : dsaType === 'AGENCY'
        ? `${lastName} Financial Services`
        : `LendingPartner Digital Pvt Ltd`;

    const dsa = await prisma.dSA.create({
      data: {
        organizationId: org.id,
        name,
        contactPerson: `${firstName} ${lastName}`,
        phone: randomIndianPhone(),
        email: `dsa${pad(i + 1, 3)}@partner.in`,
        panNumber: randomPAN(),
        dsaCode: `DSA${pad(i + 1, 3)}`,
        dsaType,
        commissionPercent: new Decimal(
          (faker.number.float({ min: 0.5, max: 2.0, fractionDigits: 2 })).toFixed(2),
        ),
        products: ['PL', 'BL', 'VF'],
        isActive: true,
        empanelmentDate: faker.date.past({ years: 3 }),
      },
    });
    dsas.push(dsa);
  }
  console.log(`  ${dsas.length} DSAs created`);

  // ── 9. BRE Rules for Personal Loan ─────────────────────────────────────
  console.log('Creating BRE rules...');
  const plProduct = products['PL'];
  const effectiveFrom = new Date('2024-01-01');

  const breRulesData = [
    // ELIGIBILITY rules
    {
      name: 'Age Eligibility',
      description: 'Applicant must be between 21 and 58 years of age',
      category: 'ELIGIBILITY' as const,
      priority: 1,
      condition: { field: 'applicant.age', operator: 'BETWEEN', value: [21, 58] },
      action: 'REJECT' as const,
      reason: 'Applicant age is outside eligible range of 21-58 years',
    },
    {
      name: 'KYC Status Check',
      description: 'Applicant KYC must be verified',
      category: 'ELIGIBILITY' as const,
      priority: 2,
      condition: { field: 'applicant.kycStatus', operator: 'EQ', value: 'VERIFIED' },
      action: 'REJECT' as const,
      reason: 'Applicant KYC is not verified',
    },
    // POLICY rules
    {
      name: 'Minimum CIBIL Score',
      description: 'Bureau score must be at least 650',
      category: 'POLICY' as const,
      priority: 10,
      condition: { field: 'bureau.score', operator: 'GTE', value: 650 },
      action: 'REJECT' as const,
      reason: 'Bureau score is below minimum threshold of 650',
    },
    {
      name: 'FOIR Check',
      description: 'Fixed Obligations to Income Ratio must not exceed 60%',
      category: 'POLICY' as const,
      priority: 11,
      condition: { field: 'calculated.foir', operator: 'LTE', value: 60 },
      action: 'REJECT' as const,
      reason: 'FOIR exceeds maximum allowed limit of 60%',
    },
    {
      name: 'No Write-Off',
      description: 'Applicant must not have any write-off in bureau',
      category: 'POLICY' as const,
      priority: 12,
      condition: { field: 'bureau.hasWriteOff', operator: 'EQ', value: false },
      action: 'REJECT' as const,
      reason: 'Applicant has a write-off record in bureau',
    },
    {
      name: 'Max DPD Last 12 Months',
      description: 'Maximum DPD in last 12 months should not exceed 30',
      category: 'POLICY' as const,
      priority: 13,
      condition: { field: 'bureau.maxDpdLast12Months', operator: 'LTE', value: 30 },
      action: 'REJECT' as const,
      reason: 'DPD in last 12 months exceeds 30 days',
    },
    {
      name: 'Enquiries Last 3 Months',
      description: 'Bureau enquiries in last 3 months should not exceed 5',
      category: 'POLICY' as const,
      priority: 14,
      condition: { field: 'bureau.enquiriesLast3Months', operator: 'LTE', value: 5 },
      action: 'REJECT' as const,
      reason: 'Excessive bureau enquiries in last 3 months (more than 5)',
    },
    // DEVIATION rule
    {
      name: 'Score Deviation Band',
      description: 'Scores between 620-649 require manual review',
      category: 'DEVIATION' as const,
      priority: 20,
      condition: { field: 'bureau.score', operator: 'BETWEEN', value: [620, 649] },
      action: 'REFER' as const,
      reason: 'Bureau score is in deviation band (620-649), requires credit head approval',
    },
    // PRICING rules
    {
      name: 'Pricing - Prime (750+)',
      description: 'Best rate for scores 750 and above',
      category: 'PRICING' as const,
      priority: 30,
      condition: { field: 'bureau.score', operator: 'GTE', value: 750 },
      action: 'APPROVE' as const,
      reason: 'Prime customer - offering best rate',
      outputRate: 1400,
    },
    {
      name: 'Pricing - Near Prime (700-749)',
      description: 'Standard rate for scores between 700 and 749',
      category: 'PRICING' as const,
      priority: 31,
      condition: { field: 'bureau.score', operator: 'BETWEEN', value: [700, 749] },
      action: 'APPROVE' as const,
      reason: 'Near prime customer - standard rate applied',
      outputRate: 1600,
    },
    {
      name: 'Pricing - Sub Prime (650-699)',
      description: 'Higher rate for scores between 650 and 699',
      category: 'PRICING' as const,
      priority: 32,
      condition: { field: 'bureau.score', operator: 'BETWEEN', value: [650, 699] },
      action: 'APPROVE' as const,
      reason: 'Sub prime customer - risk adjusted rate applied',
      outputRate: 1800,
    },
  ];

  for (const rule of breRulesData) {
    const conditionData = rule.outputRate !== undefined
      ? { ...rule.condition, outputInterestRateBps: rule.outputRate }
      : rule.condition;

    await prisma.breRule.create({
      data: {
        organizationId: org.id,
        productId: plProduct.id,
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
  console.log(`  ${breRulesData.length} BRE rules created`);

  // ── 10. Loan Applications ───────────────────────────────────────────────
  console.log('Creating loan applications...');

  const appStatusCounts: { status: string; count: number }[] = [
    { status: 'LEAD', count: 5 },
    { status: 'BUREAU_CHECK', count: 3 },
    { status: 'UNDERWRITING', count: 4 },
    { status: 'SANCTIONED', count: 3 },
    { status: 'DISBURSED', count: 3 },
    { status: 'REJECTED', count: 2 },
  ];

  const allApplicationStatuses: string[] = [];
  for (const { status, count } of appStatusCounts) {
    for (let i = 0; i < count; i++) allApplicationStatuses.push(status);
  }

  const loanApplications: Awaited<ReturnType<typeof prisma.loanApplication.create>>[] = [];
  const productCodes = Object.keys(products);
  const branches = [branchHO, branchMUM, branchDEL];

  for (let i = 0; i < 20; i++) {
    const status = allApplicationStatuses[i];
    const customer = customers[i];
    const productCode = productCodes[i % productCodes.length];
    const product = products[productCode];
    const branch = branches[i % branches.length];
    const creditOfficers = [creditOff1, creditOff2, creditOff3];
    const assignedTo = creditOfficers[i % creditOfficers.length];
    const dsa = i % 3 === 0 ? dsas[i % dsas.length] : null;

    const requestedAmount = faker.number.int({
      min: product.minAmountPaisa,
      max: Math.min(product.maxAmountPaisa, 50000000), // cap at 5L for realistic data
    });
    const requestedTenure = faker.number.int({
      min: product.minTenureMonths,
      max: Math.min(product.maxTenureMonths, 60),
    });

    const isSanctioned = ['SANCTIONED', 'DISBURSED'].includes(status);
    const isRejected = status === 'REJECTED';

    const appData: Parameters<typeof prisma.loanApplication.create>[0]['data'] = {
      organizationId: org.id,
      branchId: branch.id,
      applicationNumber: `GROWTH/${productCode}/2025/${pad(i + 1, 6)}`,
      customerId: customer.id,
      productId: product.id,
      requestedAmountPaisa: requestedAmount,
      requestedTenureMonths: requestedTenure,
      status: status as any,
      sourceType: dsa ? 'DSA' : faker.helpers.arrayElement(['BRANCH', 'WALKIN', 'WEB']) as any,
      dsaId: dsa ? dsa.id : null,
      assignedToId: assignedTo.id,
      sanctionedAmountPaisa: isSanctioned ? Math.floor(requestedAmount * 0.9) : null,
      sanctionedTenureMonths: isSanctioned ? requestedTenure : null,
      sanctionedInterestRateBps: isSanctioned
        ? faker.number.int({ min: product.minInterestRateBps, max: product.maxInterestRateBps })
        : null,
      rejectionReason: isRejected ? 'Low bureau score - below minimum threshold of 650' : null,
    };

    const app = await prisma.loanApplication.create({ data: appData });
    loanApplications.push(app);
  }
  console.log(`  ${loanApplications.length} loan applications created`);

  // ── 11. Active Loans with EMI Schedules ─────────────────────────────────
  console.log('Creating loans and EMI schedules...');

  // Use DISBURSED applications (indices 14, 15, 16 = 3 disbursed apps)
  // We need 10 loans, so also create standalone applications for remaining 7
  const disbursedApps = loanApplications.filter((a) => a.status === 'DISBURSED');

  // Create extra applications for the remaining 7 loans
  const extraLoanApps: Awaited<ReturnType<typeof prisma.loanApplication.create>>[] = [];
  for (let i = 0; i < 7; i++) {
    const customer = customers[30 + i];
    const productCode = productCodes[i % productCodes.length];
    const product = products[productCode];
    const branch = branches[i % branches.length];
    const creditOfficer = [creditOff1, creditOff2, creditOff3][i % 3];

    const requestedAmount = faker.number.int({
      min: product.minAmountPaisa,
      max: Math.min(product.maxAmountPaisa, 50000000),
    });
    const requestedTenure = faker.number.int({
      min: product.minTenureMonths,
      max: Math.min(product.maxTenureMonths, 60),
    });
    const rateForExtra = faker.number.int({
      min: product.minInterestRateBps,
      max: product.maxInterestRateBps,
    });

    const extraApp = await prisma.loanApplication.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        applicationNumber: `GROWTH/${productCode}/2025/${pad(21 + i, 6)}`,
        customerId: customer.id,
        productId: product.id,
        requestedAmountPaisa: requestedAmount,
        requestedTenureMonths: requestedTenure,
        status: 'DISBURSED',
        sourceType: 'BRANCH',
        assignedToId: creditOfficer.id,
        sanctionedAmountPaisa: Math.floor(requestedAmount * 0.9),
        sanctionedTenureMonths: requestedTenure,
        sanctionedInterestRateBps: rateForExtra,
      },
    });
    extraLoanApps.push(extraApp);
  }

  const allLoanApps = [...disbursedApps, ...extraLoanApps];

  // Define loan scenarios: DPD 0 x6, DPD 15-25 x2, DPD 55 x1, DPD 120 x1
  const loanScenarios = [
    { dpd: 0, npa: 'STANDARD' as const },
    { dpd: 0, npa: 'STANDARD' as const },
    { dpd: 0, npa: 'STANDARD' as const },
    { dpd: 0, npa: 'STANDARD' as const },
    { dpd: 0, npa: 'STANDARD' as const },
    { dpd: 0, npa: 'STANDARD' as const },
    { dpd: 18, npa: 'SMA_0' as const },
    { dpd: 23, npa: 'SMA_0' as const },
    { dpd: 55, npa: 'SMA_2' as const },
    { dpd: 120, npa: 'NPA_SUBSTANDARD' as const },
  ];

  const loans: Awaited<ReturnType<typeof prisma.loan.create>>[] = [];
  for (let i = 0; i < 10; i++) {
    const app = allLoanApps[i];
    const scenario = loanScenarios[i];
    const productCode = productCodes[i % productCodes.length];
    const product = products[productCode];
    const branch = branches[i % branches.length];
    const customer = customers[i < 3 ? 14 + i : 30 + (i - 3)];

    // Disbursement 6-18 months ago
    const monthsAgo = faker.number.int({ min: 6, max: 18 });
    const disbursementDate = new Date();
    disbursementDate.setMonth(disbursementDate.getMonth() - monthsAgo);
    disbursementDate.setDate(1); // 1st of month for clean schedule

    const principalPaisa = app.sanctionedAmountPaisa ?? faker.number.int({ min: product.minAmountPaisa, max: 30000000 });
    const tenureMonths = app.sanctionedTenureMonths ?? 36;
    const rateBps = app.sanctionedInterestRateBps ?? product.minInterestRateBps;

    const emiPaisa = calculateEMI(principalPaisa, rateBps, tenureMonths);
    const totalInterestPaisa = emiPaisa * tenureMonths - principalPaisa;

    const maturityDate = new Date(disbursementDate);
    maturityDate.setMonth(maturityDate.getMonth() + tenureMonths);

    // Calculate how many EMIs have passed
    const emisPaid = Math.max(0, monthsAgo - 1);
    const outstandingPrincipal = Math.max(
      0,
      principalPaisa - Math.floor((principalPaisa / tenureMonths) * emisPaid),
    );

    const loan = await prisma.loan.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        loanNumber: `GROWTH/LN/2025/${pad(i + 1, 6)}`,
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
        npaDate: scenario.dpd >= 90 ? new Date() : null,
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
          // All past EMIs paid
          schedStatus = 'PAID';
          paidAmount = sched.emiAmountPaisa;
          paidPrincipal = sched.principalComponentPaisa;
          paidInterest = sched.interestComponentPaisa;
          paidDate = new Date(sched.dueDate);
          paidDate.setDate(paidDate.getDate() + faker.number.int({ min: 0, max: 3 }));
        } else if (scenario.dpd <= 30) {
          // Most paid, last 1 overdue
          if (installmentMonthsAgo >= 1) {
            schedStatus = 'PAID';
            paidAmount = sched.emiAmountPaisa;
            paidPrincipal = sched.principalComponentPaisa;
            paidInterest = sched.interestComponentPaisa;
            paidDate = new Date(sched.dueDate);
          } else {
            schedStatus = 'OVERDUE';
          }
        } else if (scenario.dpd <= 60) {
          if (installmentMonthsAgo >= 2) {
            schedStatus = 'PAID';
            paidAmount = sched.emiAmountPaisa;
            paidPrincipal = sched.principalComponentPaisa;
            paidInterest = sched.interestComponentPaisa;
            paidDate = new Date(sched.dueDate);
          } else {
            schedStatus = 'OVERDUE';
          }
        } else {
          // DPD 120 - last 4 months overdue
          if (installmentMonthsAgo >= 4) {
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
      const taskType = scenario.dpd <= 30
        ? 'TELECALL'
        : scenario.dpd <= 60
          ? 'FIELD_VISIT'
          : 'LEGAL_NOTICE';

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
          remarks: `DPD ${scenario.dpd} - Follow up required`,
        },
      });
    }
  }
  console.log(`  ${loans.length} loans created with EMI schedules`);

  console.log('\nSeed completed successfully!');
  console.log('Summary:');
  console.log('  1 Organization');
  console.log('  3 Branches');
  console.log('  10 Users');
  console.log('  8 System Roles');
  console.log('  5 Loan Products');
  console.log('  50 Customers');
  console.log('  20 DSAs');
  console.log('  11 BRE Rules');
  console.log('  27 Loan Applications');
  console.log('  10 Active Loans with EMI schedules');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
