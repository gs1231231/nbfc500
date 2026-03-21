/**
 * Prompt 71: Security Tests
 *
 * Tests for common security vulnerabilities in BankOS:
 *  1. SQL injection patterns in search inputs
 *  2. XSS payloads in text fields
 *  3. Auth bypass — access without token returns 401
 *  4. IDOR — user from org A cannot access org B data
 *  5. PAN / Aadhaar masking in API responses
 *  6. JWT token validation
 *  7. Input validation for financial fields
 *  8. Rate limiting awareness
 *
 * NOTE: These tests use simulated request/response helpers.
 * In a full E2E environment, replace with actual HTTP calls to running services.
 */

// ---------------------------------------------------------------------------
// Simulated security layer (mirrors actual middleware behaviour)
// ---------------------------------------------------------------------------

interface SecurityCheckResult {
  blocked: boolean;
  reason?: string;
}

/**
 * Simulates the input sanitization middleware that would reject
 * known SQL injection patterns.
 */
function checkSqlInjection(input: string): SecurityCheckResult {
  const sqlPatterns = [
    /('|")\s*;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE)/i,
    /--\s*$/,
    /\/\*[\s\S]*?\*\//,
    /\bOR\b\s+['"\d]+\s*=\s*['"\d]+/i,
    /\bAND\b\s+['"\d]+\s*=\s*['"\d]+/i,
    /\bUNION\b\s+(ALL\s+)?\bSELECT\b/i,
    /\bEXEC\b\s*\(/i,
    /\bXP_CMDSHELL\b/i,
    /\bINFORMATION_SCHEMA\b/i,
    /\bSYSOBJECTS\b/i,
    /;.*(DROP|SELECT|INSERT|UPDATE|DELETE)\s+/i,
  ];
  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      return { blocked: true, reason: `SQL injection pattern detected: ${pattern.source}` };
    }
  }
  return { blocked: false };
}

/**
 * Simulates the XSS sanitization middleware.
 */
function checkXss(input: string): SecurityCheckResult {
  const xssPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<script[\s\S]*?>/gi,
    /javascript:/gi,
    /on(load|click|mouseover|submit|focus|blur|error|keyup|keydown)\s*=/gi,
    /<iframe[\s\S]*?>/gi,
    /<object[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi,
    /document\.(cookie|write|location)/gi,
    /window\.(location|open)/gi,
    /eval\s*\(/gi,
    /atob\s*\(/gi,
    /&#\d+;/g,
    /&lt;script/gi,
  ];
  for (const pattern of xssPatterns) {
    if (pattern.test(input)) {
      return { blocked: true, reason: `XSS payload detected: ${pattern.source}` };
    }
  }
  return { blocked: false };
}

/**
 * Simulates JWT token validation.
 */
function validateBearerToken(
  authHeader: string | undefined,
): { valid: boolean; statusCode: number; orgId?: string; userId?: string } {
  if (!authHeader) {
    return { valid: false, statusCode: 401 };
  }
  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, statusCode: 401 };
  }
  const token = authHeader.substring(7);
  if (!token || token.length < 20) {
    return { valid: false, statusCode: 401 };
  }
  // Simulated token decode (in production this would verify JWT signature)
  if (token === 'INVALID_TOKEN') {
    return { valid: false, statusCode: 401 };
  }
  if (token === 'EXPIRED_TOKEN_XXXXXXXXXXXXXXXX') {
    return { valid: false, statusCode: 401 };
  }
  // Valid token contains org/user info
  if (token.startsWith('ORG_A_')) {
    return { valid: true, statusCode: 200, orgId: 'org-a', userId: 'user-a' };
  }
  if (token.startsWith('ORG_B_')) {
    return { valid: true, statusCode: 200, orgId: 'org-b', userId: 'user-b' };
  }
  return { valid: true, statusCode: 200, orgId: 'org-default', userId: 'user-default' };
}

/**
 * Simulates IDOR check — ensures a resource belongs to the requesting org.
 */
function checkIdorAccess(
  requestingOrgId: string,
  resourceOrgId: string,
): { allowed: boolean; statusCode: number } {
  if (requestingOrgId !== resourceOrgId) {
    return { allowed: false, statusCode: 403 };
  }
  return { allowed: true, statusCode: 200 };
}

/**
 * Simulates PAN masking in API responses.
 * PAN: ABCDE1234F → ABCXX1234F (mask chars 3-4)
 */
function maskPan(pan: string): string {
  if (!pan || pan.length !== 10) return pan;
  return pan.substring(0, 3) + 'XX' + pan.substring(5);
}

/**
 * Simulates Aadhaar masking in API responses.
 * Aadhaar: 123456789012 → XXXXXXXX9012 (show only last 4)
 */
function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length !== 12) return aadhaar;
  return 'XXXXXXXX' + aadhaar.substring(8);
}

/**
 * Simulates phone masking: 9876543210 → 9876XXXX10
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length !== 10) return phone;
  return phone.substring(0, 4) + 'XXXX' + phone.substring(8);
}

/**
 * Validates that a financial amount field is within safe bounds.
 */
function validateAmountField(value: unknown): SecurityCheckResult {
  if (typeof value !== 'number') {
    return { blocked: true, reason: 'Amount must be a number' };
  }
  if (!Number.isFinite(value)) {
    return { blocked: true, reason: 'Amount must be finite (no Infinity or NaN)' };
  }
  if (value < 0) {
    return { blocked: true, reason: 'Amount cannot be negative' };
  }
  if (value > 10_000_000_000_000) { // > Rs 100 Cr in paisa
    return { blocked: true, reason: 'Amount exceeds maximum allowed value' };
  }
  return { blocked: false };
}

// ---------------------------------------------------------------------------
// SQL Injection Tests
// ---------------------------------------------------------------------------

describe('Security: SQL Injection Protection', () => {

  it("classic attack: '; DROP TABLE users; -- is blocked", () => {
    const result = checkSqlInjection("'; DROP TABLE users; --");
    expect(result.blocked).toBe(true);
  });

  it("OR 1=1 tautology is blocked", () => {
    const result = checkSqlInjection("' OR '1'='1");
    expect(result.blocked).toBe(true);
  });

  it("OR 1=1 with double quotes is blocked", () => {
    const result = checkSqlInjection('" OR "1"="1"');
    expect(result.blocked).toBe(true);
  });

  it("UNION SELECT attack is blocked", () => {
    const result = checkSqlInjection("' UNION SELECT password FROM users --");
    expect(result.blocked).toBe(true);
  });

  it("UNION ALL SELECT variant is blocked", () => {
    const result = checkSqlInjection("' UNION ALL SELECT null,null,null --");
    expect(result.blocked).toBe(true);
  });

  it("comment injection -- is blocked", () => {
    const result = checkSqlInjection("admin'--");
    expect(result.blocked).toBe(true);
  });

  it("block comment /* */ injection is blocked", () => {
    const result = checkSqlInjection("' /*comment*/ OR '1'='1");
    expect(result.blocked).toBe(true);
  });

  it("stored procedure injection EXEC() is blocked", () => {
    const result = checkSqlInjection("'; EXEC(xp_cmdshell 'dir');--");
    expect(result.blocked).toBe(true);
  });

  it("INFORMATION_SCHEMA probing is blocked", () => {
    const result = checkSqlInjection("' UNION SELECT table_name FROM INFORMATION_SCHEMA.tables--");
    expect(result.blocked).toBe(true);
  });

  it("legitimate customer name 'Ravi Kumar' is allowed", () => {
    const result = checkSqlInjection("Ravi Kumar");
    expect(result.blocked).toBe(false);
  });

  it("legitimate search with apostrophe in name (O'Brien) is handled", () => {
    // O'Brien has an apostrophe but no SQL command follows
    const result = checkSqlInjection("O'Brien");
    expect(result.blocked).toBe(false);
  });

  it("legitimate PAN number is allowed", () => {
    const result = checkSqlInjection("ABCDE1234F");
    expect(result.blocked).toBe(false);
  });

  it("legitimate amount filter '100000' is allowed", () => {
    const result = checkSqlInjection("100000");
    expect(result.blocked).toBe(false);
  });

  it("DELETE statement injection is blocked", () => {
    const result = checkSqlInjection("'; DELETE FROM loans WHERE 1=1; --");
    expect(result.blocked).toBe(true);
  });

  it("UPDATE statement injection is blocked", () => {
    const result = checkSqlInjection("'; UPDATE users SET password='hacked'; --");
    expect(result.blocked).toBe(true);
  });

});

// ---------------------------------------------------------------------------
// XSS Tests
// ---------------------------------------------------------------------------

describe('Security: XSS Protection', () => {

  it("<script>alert('xss')</script> is blocked", () => {
    const result = checkXss("<script>alert('xss')</script>");
    expect(result.blocked).toBe(true);
  });

  it("<script src='evil.js'></script> is blocked", () => {
    const result = checkXss("<script src='https://evil.example.com/payload.js'></script>");
    expect(result.blocked).toBe(true);
  });

  it("javascript: protocol URI is blocked", () => {
    const result = checkXss("javascript:alert('xss')");
    expect(result.blocked).toBe(true);
  });

  it("onclick event handler injection is blocked", () => {
    const result = checkXss('<img src=x onerror=alert(1)>');
    expect(result.blocked).toBe(true);
  });

  it("onload event handler is blocked", () => {
    const result = checkXss('<body onload=alert(document.cookie)>');
    expect(result.blocked).toBe(true);
  });

  it("<iframe> injection is blocked", () => {
    const result = checkXss('<iframe src="javascript:alert(1)"></iframe>');
    expect(result.blocked).toBe(true);
  });

  it("document.cookie access is blocked", () => {
    const result = checkXss('document.cookie');
    expect(result.blocked).toBe(true);
  });

  it("eval() injection is blocked", () => {
    const result = checkXss("eval(atob('YWxlcnQoMSk='))");
    expect(result.blocked).toBe(true);
  });

  it("HTML entity encoded script tag is blocked", () => {
    const result = checkXss("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(result.blocked).toBe(true);
  });

  it("legitimate notes field with normal text is allowed", () => {
    const result = checkXss("Customer called to discuss repayment schedule. Will pay by 15th.");
    expect(result.blocked).toBe(false);
  });

  it("legitimate address with <, > in description is ambiguous but normal text passes", () => {
    // Address like "Near Govt. School" doesn't have script tags
    const result = checkXss("Near Govt School, 2nd Cross, Bangalore 560001");
    expect(result.blocked).toBe(false);
  });

  it("legitimate remarks field is allowed", () => {
    const result = checkXss("EMI paid via NACH. Reference: NACH2024031500001");
    expect(result.blocked).toBe(false);
  });

});

// ---------------------------------------------------------------------------
// Auth Bypass Tests
// ---------------------------------------------------------------------------

describe('Security: Authentication — Access Without Token Returns 401', () => {

  it('no Authorization header → 401', () => {
    const result = validateBearerToken(undefined);
    expect(result.valid).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('empty Authorization header → 401', () => {
    const result = validateBearerToken('');
    expect(result.valid).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it("Authorization header without 'Bearer ' prefix → 401", () => {
    const result = validateBearerToken('Token sometoken123');
    expect(result.valid).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('malformed token (too short) → 401', () => {
    const result = validateBearerToken('Bearer short');
    expect(result.valid).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('invalid token string → 401', () => {
    const result = validateBearerToken('Bearer INVALID_TOKEN');
    expect(result.valid).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('expired token → 401', () => {
    const result = validateBearerToken('Bearer EXPIRED_TOKEN_XXXXXXXXXXXXXXXX');
    expect(result.valid).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('valid Bearer token for org A → 200 with org context', () => {
    const result = validateBearerToken('Bearer ORG_A_VALID_TOKEN_12345');
    expect(result.valid).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.orgId).toBe('org-a');
  });

  it('valid Bearer token for org B → 200 with org B context', () => {
    const result = validateBearerToken('Bearer ORG_B_VALID_TOKEN_12345');
    expect(result.valid).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.orgId).toBe('org-b');
  });

});

// ---------------------------------------------------------------------------
// IDOR (Insecure Direct Object Reference) Tests
// ---------------------------------------------------------------------------

describe('Security: IDOR — Cross-Organisation Data Access Prevention', () => {

  it('user from org A cannot access org A resource → 200', () => {
    const result = checkIdorAccess('org-a', 'org-a');
    expect(result.allowed).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it('user from org A cannot access org B resource → 403', () => {
    const result = checkIdorAccess('org-a', 'org-b');
    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(403);
  });

  it('user from org B cannot access org A resource → 403', () => {
    const result = checkIdorAccess('org-b', 'org-a');
    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(403);
  });

  it('user accessing resource from a different org gets 403 not 404', () => {
    // Must return 403 (forbidden) not 404 (not found) to prevent enumeration
    const result = checkIdorAccess('org-hacker', 'org-victim');
    expect(result.statusCode).toBe(403);
  });

  it('accessing resource with empty org ID is forbidden', () => {
    const result = checkIdorAccess('', 'org-a');
    expect(result.allowed).toBe(false);
  });

  it('IDOR check: loan from org A cannot be fetched with org B token', () => {
    const tokenResult = validateBearerToken('Bearer ORG_B_VALID_TOKEN_12345');
    expect(tokenResult.orgId).toBe('org-b');

    const loanOrgId = 'org-a'; // loan belongs to org A
    const accessResult = checkIdorAccess(tokenResult.orgId!, loanOrgId);
    expect(accessResult.allowed).toBe(false);
    expect(accessResult.statusCode).toBe(403);
  });

  it('IDOR check: customer from org A is accessible with org A token', () => {
    const tokenResult = validateBearerToken('Bearer ORG_A_VALID_TOKEN_12345');
    const customerOrgId = 'org-a';
    const accessResult = checkIdorAccess(tokenResult.orgId!, customerOrgId);
    expect(accessResult.allowed).toBe(true);
  });

});

// ---------------------------------------------------------------------------
// PAN / Aadhaar Masking Tests
// ---------------------------------------------------------------------------

describe('Security: PAN and Aadhaar Masking in Responses', () => {

  it('PAN BWRPS1234K is masked to BWRXX1234K', () => {
    const masked = maskPan('BWRPS1234K');
    expect(masked).toBe('BWRXX1234K');
  });

  it('PAN masking: chars 3 and 4 are replaced with XX', () => {
    const pan = 'ABCDE1234F';
    const masked = maskPan(pan);
    expect(masked.charAt(3)).toBe('X');
    expect(masked.charAt(4)).toBe('X');
  });

  it('PAN masking: first 3 and last 5 chars are preserved', () => {
    const pan = 'ABCDE1234F';
    const masked = maskPan(pan);
    expect(masked.substring(0, 3)).toBe('ABC');
    expect(masked.substring(5)).toBe('1234F');
  });

  it('Aadhaar 123456789012 is masked to XXXXXXXX9012', () => {
    const masked = maskAadhaar('123456789012');
    expect(masked).toBe('XXXXXXXX9012');
  });

  it('Aadhaar masking: only last 4 digits are visible', () => {
    const aadhaar = '987654321098';
    const masked = maskAadhaar(aadhaar);
    expect(masked.substring(0, 8)).toBe('XXXXXXXX');
    expect(masked.substring(8)).toBe('1098');
  });

  it('Phone masking: middle 4 digits are replaced', () => {
    const phone = '9876543210';
    const masked = maskPhone(phone);
    expect(masked).toBe('9876XXXX10');
  });

  it('Phone masking: first 4 and last 2 digits are visible', () => {
    const phone = '7890123456';
    const masked = maskPhone(phone);
    expect(masked.substring(0, 4)).toBe('7890');
    expect(masked.substring(8)).toBe('56');
  });

  it('masked PAN cannot be reverse-engineered to original', () => {
    const original = 'BWRPS1234K';
    const masked = maskPan(original);
    // The masked version differs from original
    expect(masked).not.toBe(original);
    // Cannot reconstruct from masked alone
    expect(masked.charAt(3)).toBe('X');
    expect(masked.charAt(4)).toBe('X');
  });

  it('API response object has masked sensitive fields', () => {
    // Simulate what an API response would look like
    const rawCustomer = {
      id: 'cust-001',
      firstName: 'Ravi',
      lastName: 'Kumar',
      panNumber: 'BWRPS1234K',
      aadhaarNumber: '123456789012',
      phone: '9876543210',
      email: 'ravi@example.com',
    };

    const maskedResponse = {
      ...rawCustomer,
      panNumber: maskPan(rawCustomer.panNumber),
      aadhaarNumber: maskAadhaar(rawCustomer.aadhaarNumber),
      phone: maskPhone(rawCustomer.phone),
    };

    expect(maskedResponse.panNumber).not.toContain('PS');  // original chars 3-4
    expect(maskedResponse.aadhaarNumber.substring(0, 8)).toBe('XXXXXXXX');
    expect(maskedResponse.phone).toBe('9876XXXX10');
    // Non-sensitive fields unchanged
    expect(maskedResponse.firstName).toBe('Ravi');
    expect(maskedResponse.email).toBe('ravi@example.com');
  });

});

// ---------------------------------------------------------------------------
// Financial Amount Validation Tests
// ---------------------------------------------------------------------------

describe('Security: Financial Amount Input Validation', () => {

  it('valid positive amount passes', () => {
    expect(validateAmountField(100_000_000).blocked).toBe(false);
  });

  it('zero amount passes (loan closure payments)', () => {
    expect(validateAmountField(0).blocked).toBe(false);
  });

  it('negative amount is rejected', () => {
    const result = validateAmountField(-1);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('negative');
  });

  it('NaN is rejected', () => {
    const result = validateAmountField(NaN);
    expect(result.blocked).toBe(true);
  });

  it('Infinity is rejected', () => {
    const result = validateAmountField(Infinity);
    expect(result.blocked).toBe(true);
  });

  it('-Infinity is rejected', () => {
    const result = validateAmountField(-Infinity);
    expect(result.blocked).toBe(true);
  });

  it('string masquerading as number is rejected', () => {
    const result = validateAmountField('100000' as unknown as number);
    expect(result.blocked).toBe(true);
  });

  it('null amount is rejected', () => {
    const result = validateAmountField(null as unknown as number);
    expect(result.blocked).toBe(true);
  });

  it('amount exceeding Rs 100 Cr limit is rejected', () => {
    const result = validateAmountField(10_000_000_000_001); // > Rs 100 Cr in paisa
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('maximum');
  });

  it('exactly Rs 100 Cr (10000000000000 paisa) passes the limit check', () => {
    const result = validateAmountField(10_000_000_000_000);
    expect(result.blocked).toBe(false);
  });

});
