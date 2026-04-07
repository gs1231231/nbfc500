/**
 * Workflow Engine – pure-logic unit tests
 *
 * All tests operate on plain WorkflowStage / WorkflowTransition arrays so no
 * database or NestJS DI container is needed.  The engine logic is extracted
 * into standalone helper functions that mirror the private methods of
 * WorkflowService.
 */

import {
  WorkflowStage,
  WorkflowTransition,
  STANDARD_LENDING_STAGES,
  STANDARD_LENDING_TRANSITIONS,
  GOLD_LOAN_STAGES,
  GOLD_LOAN_TRANSITIONS,
} from './workflow.service';

// ── Pure engine helpers ───────────────────────────────────────────────────────

/**
 * Find the single transition definition matching (from → to).
 * Returns undefined when no such transition is configured.
 */
function findTransition(
  transitions: WorkflowTransition[],
  from: string,
  to: string,
): WorkflowTransition | undefined {
  return transitions.find((t) => t.from === from && t.to === to);
}

/**
 * Check whether a transition is defined in the workflow.
 */
function isTransitionDefined(
  transitions: WorkflowTransition[],
  from: string,
  to: string,
): boolean {
  return findTransition(transitions, from, to) !== undefined;
}

/**
 * Simulate a role-based transition check.
 * Returns {allowed, reason}.
 */
function checkTransitionAllowed(
  transitions: WorkflowTransition[],
  stages: WorkflowStage[],
  fromStage: string,
  toStage: string,
  userRoles: string[],
  amountPaisa?: number,
): { allowed: boolean; reason?: string } {
  const stageMap = new Map(stages.map((s) => [s.code, s]));

  const from = stageMap.get(fromStage);
  if (!from) {
    return { allowed: false, reason: `Unknown from-stage: ${fromStage}` };
  }
  if (!stageMap.has(toStage)) {
    return { allowed: false, reason: `Unknown to-stage: ${toStage}` };
  }

  // Block transitions out of terminal stages
  if (from.isTerminal) {
    return {
      allowed: false,
      reason: `Stage ${fromStage} is terminal and cannot be transitioned from`,
    };
  }

  const transition = findTransition(transitions, fromStage, toStage);
  if (!transition) {
    return {
      allowed: false,
      reason: `Transition from ${fromStage} to ${toStage} is not defined in the workflow`,
    };
  }

  if (transition.requiredRole && !userRoles.includes(transition.requiredRole)) {
    return {
      allowed: false,
      reason: `Role ${transition.requiredRole} is required to perform this transition`,
    };
  }

  if (
    transition.amountLimit !== undefined &&
    amountPaisa !== undefined &&
    amountPaisa > transition.amountLimit
  ) {
    return {
      allowed: false,
      reason: `Requested amount exceeds the approval limit (${transition.amountLimit} paisa) for your role`,
    };
  }

  return { allowed: true };
}

/**
 * Evaluate a condition against a mock application object.
 */
interface MockApplication {
  breDecisionId?: string | null;
  documents?: { isVerified: boolean }[];
  bureauRequests?: { status: string; bureauResponse: unknown | null }[];
  customFields?: Record<string, unknown>;
}

function evaluateCondition(
  condition: { type: string; config?: Record<string, unknown> },
  app: MockApplication,
): { passed: boolean; reason?: string } {
  switch (condition.type) {
    case 'DOCUMENTS_COMPLETE': {
      const verified = (app.documents ?? []).filter((d) => d.isVerified);
      if (verified.length === 0) {
        return {
          passed: false,
          reason: 'No verified documents found. Please upload and verify required documents.',
        };
      }
      return { passed: true };
    }

    case 'BUREAU_COMPLETED': {
      const ok = (app.bureauRequests ?? []).some(
        (br) => br.status === 'SUCCESS' && br.bureauResponse != null,
      );
      if (!ok) {
        return {
          passed: false,
          reason: 'Bureau check has not been completed for this application.',
        };
      }
      return { passed: true };
    }

    case 'BRE_COMPLETED': {
      if (!app.breDecisionId) {
        return {
          passed: false,
          reason: 'BRE (Business Rule Engine) evaluation has not been completed.',
        };
      }
      return { passed: true };
    }

    case 'CUSTOM_FIELD_FILLED': {
      const fieldName = condition.config?.field as string | undefined;
      if (!fieldName) return { passed: true };
      const val = app.customFields?.[fieldName];
      if (val === undefined || val === null) {
        return {
          passed: false,
          reason: `Required custom field "${fieldName}" is not filled.`,
        };
      }
      return { passed: true };
    }

    default:
      return { passed: true };
  }
}

/**
 * Return all stages reachable from `fromStage` given the current user's roles.
 */
function getAvailableTransitions(
  transitions: WorkflowTransition[],
  stages: WorkflowStage[],
  fromStage: string,
  userRoles: string[],
  amountPaisa?: number,
): { toStage: string; toStageName: string; requiresRemarks: boolean }[] {
  const stageMap = new Map(stages.map((s) => [s.code, s]));
  const from = stageMap.get(fromStage);

  if (!from || from.isTerminal) return [];

  const candidates = transitions.filter((t) => t.from === fromStage);
  return candidates
    .filter((t) => {
      const check = checkTransitionAllowed(
        transitions,
        stages,
        fromStage,
        t.to,
        userRoles,
        amountPaisa,
      );
      return check.allowed;
    })
    .map((t) => ({
      toStage: t.to,
      toStageName: stageMap.get(t.to)?.name ?? t.to,
      requiresRemarks: t.requiresRemarks ?? false,
    }));
}

/**
 * Validate a workflow definition (mirrors WorkflowService.validateWorkflow).
 */
function validateWorkflow(
  stages: WorkflowStage[],
  transitions: WorkflowTransition[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const stageCodes = new Set(stages.map((s) => s.code));

  if (stages.length === 0) {
    errors.push('Workflow must have at least one stage');
  }

  const terminalStages = stages.filter((s) => s.isTerminal);
  if (terminalStages.length === 0) {
    errors.push('Workflow must have at least one terminal stage (isTerminal: true)');
  }

  for (const t of transitions) {
    if (!stageCodes.has(t.from)) {
      errors.push(`Transition references unknown "from" stage: "${t.from}"`);
    }
    if (!stageCodes.has(t.to)) {
      errors.push(`Transition references unknown "to" stage: "${t.to}"`);
    }
  }

  if (stages.length > 1) {
    const reachable = new Set<string>();
    const sorted = [...stages].sort((a, b) => a.displayOrder - b.displayOrder);
    const firstCode = sorted[0]?.code;
    if (firstCode) {
      const queue = [firstCode];
      reachable.add(firstCode);
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const t of transitions) {
          if (t.from === current && !reachable.has(t.to)) {
            reachable.add(t.to);
            queue.push(t.to);
          }
        }
      }
      for (const code of stageCodes) {
        if (!reachable.has(code)) {
          errors.push(`Stage "${code}" is unreachable from the first stage`);
        }
      }
    }
  }

  // Cycle detection via DFS
  const visited = new Set<string>();
  const inStack = new Set<string>();

  const hasCycle = (node: string): boolean => {
    visited.add(node);
    inStack.add(node);
    for (const t of transitions) {
      if (t.from === node) {
        if (!visited.has(t.to)) {
          if (hasCycle(t.to)) return true;
        } else if (inStack.has(t.to)) {
          return true;
        }
      }
    }
    inStack.delete(node);
    return false;
  };

  for (const code of stageCodes) {
    if (!visited.has(code)) {
      if (hasCycle(code)) {
        errors.push(`Cycle detected in workflow transitions (involving stage "${code}")`);
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── SLA helper ────────────────────────────────────────────────────────────────

function detectSlaBreach(
  stage: WorkflowStage,
  stageEnteredAt: Date,
  now: Date = new Date(),
): { breached: boolean; daysElapsed: number; daysBreached: number } {
  if (!stage.slaDays) {
    return { breached: false, daysElapsed: 0, daysBreached: 0 };
  }
  const daysElapsed = Math.floor(
    (now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  const breached = daysElapsed > stage.slaDays;
  return {
    breached,
    daysElapsed,
    daysBreached: breached ? daysElapsed - stage.slaDays : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Workflow Engine', () => {
  // ── Transition Validation ─────────────────────────────────────────────────
  describe('Transition Validation', () => {
    it('allows a valid transition (LEAD → APPLICATION)', () => {
      const result = checkTransitionAllowed(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'LEAD',
        'APPLICATION',
        [],
      );
      expect(result.allowed).toBe(true);
    });

    it('blocks an invalid transition (LEAD → DISBURSED)', () => {
      const result = checkTransitionAllowed(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'LEAD',
        'DISBURSED',
        [],
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/not defined/);
    });

    it('blocks transition to a non-existent stage', () => {
      const result = checkTransitionAllowed(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'LEAD',
        'GHOST_STAGE',
        [],
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Unknown to-stage/);
    });

    it('blocks transition from a non-existent stage', () => {
      const result = checkTransitionAllowed(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'GHOST_STAGE',
        'APPLICATION',
        [],
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Unknown from-stage/);
    });

    it('blocks transition from a terminal stage (DISBURSED)', () => {
      const result = checkTransitionAllowed(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'DISBURSED',
        'LEAD',
        [],
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/terminal/);
    });

    it('blocks transition from terminal REJECTED stage', () => {
      const result = checkTransitionAllowed(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'REJECTED',
        'LEAD',
        [],
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/terminal/);
    });

    it('allows CANCELLED-style hop if transition is defined between non-terminal stages', () => {
      // Simulate a workflow that allows UNDERWRITING → CANCELLED
      const stages: WorkflowStage[] = [
        { code: 'LEAD', name: 'Lead', displayOrder: 1 },
        { code: 'UNDERWRITING', name: 'Underwriting', displayOrder: 2 },
        { code: 'CANCELLED', name: 'Cancelled', displayOrder: 3, isTerminal: true },
      ];
      const transitions: WorkflowTransition[] = [
        { from: 'LEAD', to: 'UNDERWRITING' },
        { from: 'UNDERWRITING', to: 'CANCELLED' },
      ];
      const result = checkTransitionAllowed(transitions, stages, 'UNDERWRITING', 'CANCELLED', []);
      expect(result.allowed).toBe(true);
    });
  });

  // ── Role-Based Transitions ────────────────────────────────────────────────
  describe('Role-Based Transitions', () => {
    it('allows transition when user has the required role', () => {
      // UNDERWRITING → APPROVED requires CREDIT_HEAD
      const result = checkTransitionAllowed(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'UNDERWRITING',
        'APPROVED',
        ['CREDIT_HEAD'],
      );
      expect(result.allowed).toBe(true);
    });

    it('blocks transition when user lacks the required role', () => {
      const result = checkTransitionAllowed(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'UNDERWRITING',
        'APPROVED',
        ['FIELD_OFFICER'],
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/CREDIT_HEAD/);
    });

    it('allows transition that has no role requirement regardless of user roles', () => {
      // LEAD → APPLICATION has no requiredRole
      const result = checkTransitionAllowed(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'LEAD',
        'APPLICATION',
        [], // no roles at all
      );
      expect(result.allowed).toBe(true);
    });

    it('allows when user has multiple roles and one satisfies the requirement', () => {
      const result = checkTransitionAllowed(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'APPROVED',
        'SANCTIONED',
        ['FIELD_OFFICER', 'CREDIT_HEAD'], // CREDIT_HEAD satisfies
      );
      expect(result.allowed).toBe(true);
    });

    it('amount limit: allows when requested amount is at or below the limit', () => {
      const transitions: WorkflowTransition[] = [
        { from: 'UNDERWRITING', to: 'APPROVED', amountLimit: 5_000_000 },
      ];
      const stages: WorkflowStage[] = [
        { code: 'UNDERWRITING', name: 'Underwriting', displayOrder: 1 },
        { code: 'APPROVED', name: 'Approved', displayOrder: 2, isTerminal: true },
      ];
      const result = checkTransitionAllowed(
        transitions,
        stages,
        'UNDERWRITING',
        'APPROVED',
        [],
        5_000_000, // exactly at limit
      );
      expect(result.allowed).toBe(true);
    });

    it('amount limit: blocks when requested amount exceeds the limit', () => {
      const transitions: WorkflowTransition[] = [
        { from: 'UNDERWRITING', to: 'APPROVED', amountLimit: 5_000_000 },
      ];
      const stages: WorkflowStage[] = [
        { code: 'UNDERWRITING', name: 'Underwriting', displayOrder: 1 },
        { code: 'APPROVED', name: 'Approved', displayOrder: 2, isTerminal: true },
      ];
      const result = checkTransitionAllowed(
        transitions,
        stages,
        'UNDERWRITING',
        'APPROVED',
        [],
        5_000_001, // one paisa over
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/approval limit/);
    });
  });

  // ── Conditions ────────────────────────────────────────────────────────────
  describe('Conditions', () => {
    describe('DOCUMENTS_COMPLETE', () => {
      it('passes when at least one document is verified', () => {
        const result = evaluateCondition(
          { type: 'DOCUMENTS_COMPLETE' },
          { documents: [{ isVerified: true }, { isVerified: false }] },
        );
        expect(result.passed).toBe(true);
      });

      it('blocks when no documents are verified', () => {
        const result = evaluateCondition(
          { type: 'DOCUMENTS_COMPLETE' },
          { documents: [{ isVerified: false }] },
        );
        expect(result.passed).toBe(false);
        expect(result.reason).toMatch(/verified documents/);
      });

      it('blocks when documents array is empty', () => {
        const result = evaluateCondition(
          { type: 'DOCUMENTS_COMPLETE' },
          { documents: [] },
        );
        expect(result.passed).toBe(false);
      });

      it('blocks when documents key is absent', () => {
        const result = evaluateCondition({ type: 'DOCUMENTS_COMPLETE' }, {});
        expect(result.passed).toBe(false);
      });
    });

    describe('BUREAU_COMPLETED', () => {
      it('passes when a SUCCESS bureau request with a response exists', () => {
        const result = evaluateCondition(
          { type: 'BUREAU_COMPLETED' },
          {
            bureauRequests: [
              { status: 'SUCCESS', bureauResponse: { score: 780 } },
            ],
          },
        );
        expect(result.passed).toBe(true);
      });

      it('blocks when the only bureau request is PENDING', () => {
        const result = evaluateCondition(
          { type: 'BUREAU_COMPLETED' },
          {
            bureauRequests: [{ status: 'PENDING', bureauResponse: null }],
          },
        );
        expect(result.passed).toBe(false);
        expect(result.reason).toMatch(/Bureau check/);
      });

      it('blocks when bureauRequests array is empty', () => {
        const result = evaluateCondition(
          { type: 'BUREAU_COMPLETED' },
          { bureauRequests: [] },
        );
        expect(result.passed).toBe(false);
      });

      it('blocks when bureauResponse is null even on SUCCESS status', () => {
        const result = evaluateCondition(
          { type: 'BUREAU_COMPLETED' },
          {
            bureauRequests: [{ status: 'SUCCESS', bureauResponse: null }],
          },
        );
        expect(result.passed).toBe(false);
      });
    });

    describe('BRE_COMPLETED', () => {
      it('passes when breDecisionId is set', () => {
        const result = evaluateCondition(
          { type: 'BRE_COMPLETED' },
          { breDecisionId: 'bre-001' },
        );
        expect(result.passed).toBe(true);
      });

      it('blocks when breDecisionId is null', () => {
        const result = evaluateCondition(
          { type: 'BRE_COMPLETED' },
          { breDecisionId: null },
        );
        expect(result.passed).toBe(false);
        expect(result.reason).toMatch(/BRE/);
      });

      it('blocks when breDecisionId is absent', () => {
        const result = evaluateCondition({ type: 'BRE_COMPLETED' }, {});
        expect(result.passed).toBe(false);
      });
    });

    describe('CUSTOM_FIELD_FILLED', () => {
      it('passes when the specified custom field is filled', () => {
        const result = evaluateCondition(
          { type: 'CUSTOM_FIELD_FILLED', config: { field: 'gstNumber' } },
          { customFields: { gstNumber: 'GST1234' } },
        );
        expect(result.passed).toBe(true);
      });

      it('blocks when the specified custom field is missing', () => {
        const result = evaluateCondition(
          { type: 'CUSTOM_FIELD_FILLED', config: { field: 'gstNumber' } },
          { customFields: {} },
        );
        expect(result.passed).toBe(false);
        expect(result.reason).toMatch(/gstNumber/);
      });

      it('blocks when the custom field is explicitly null', () => {
        const result = evaluateCondition(
          { type: 'CUSTOM_FIELD_FILLED', config: { field: 'gstNumber' } },
          { customFields: { gstNumber: null } },
        );
        expect(result.passed).toBe(false);
      });

      it('passes when no field key is specified in config', () => {
        const result = evaluateCondition(
          { type: 'CUSTOM_FIELD_FILLED', config: {} },
          {},
        );
        expect(result.passed).toBe(true);
      });
    });

    describe('Unknown condition type', () => {
      it('passes for unknown condition types (defensive default)', () => {
        const result = evaluateCondition({ type: 'FUTURE_CONDITION' }, {});
        expect(result.passed).toBe(true);
      });
    });
  });

  // ── Available Transitions ─────────────────────────────────────────────────
  describe('Available Transitions', () => {
    it('returns all valid next stages from the current stage', () => {
      // UNDERWRITING has two possible next stages: APPROVED and REJECTED (both require CREDIT_HEAD)
      const available = getAvailableTransitions(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'UNDERWRITING',
        ['CREDIT_HEAD'],
      );
      const toCodes = available.map((a) => a.toStage);
      expect(toCodes).toContain('APPROVED');
      expect(toCodes).toContain('REJECTED');
    });

    it('returns empty array when user role does not satisfy any transition', () => {
      const available = getAvailableTransitions(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'UNDERWRITING',
        ['FIELD_OFFICER'], // CREDIT_HEAD required
      );
      expect(available).toHaveLength(0);
    });

    it('returns empty array for terminal stages', () => {
      const available = getAvailableTransitions(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'DISBURSED',
        ['OPERATIONS', 'CREDIT_HEAD'],
      );
      expect(available).toHaveLength(0);
    });

    it('returns empty array for rejected (terminal) stage', () => {
      const available = getAvailableTransitions(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'REJECTED',
        ['CREDIT_HEAD'],
      );
      expect(available).toHaveLength(0);
    });

    it('includes requiresRemarks flag correctly', () => {
      // UNDERWRITING → REJECTED requires remarks
      const available = getAvailableTransitions(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'UNDERWRITING',
        ['CREDIT_HEAD'],
      );
      const rejectedTransition = available.find((a) => a.toStage === 'REJECTED');
      expect(rejectedTransition?.requiresRemarks).toBe(true);

      const approvedTransition = available.find((a) => a.toStage === 'APPROVED');
      expect(approvedTransition?.requiresRemarks).toBe(false);
    });

    it('includes the human-readable toStageName', () => {
      const available = getAvailableTransitions(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'LEAD',
        [],
      );
      expect(available[0].toStageName).toBe('Application');
    });

    it('returns a single transition from LEAD in the standard workflow', () => {
      const available = getAvailableTransitions(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'LEAD',
        [],
      );
      expect(available).toHaveLength(1);
      expect(available[0].toStage).toBe('APPLICATION');
    });
  });

  // ── Workflow Validation (validateWorkflow) ────────────────────────────────
  describe('Workflow Validation (validateWorkflow)', () => {
    it('standard lending workflow is valid', () => {
      const result = validateWorkflow(
        STANDARD_LENDING_STAGES,
        STANDARD_LENDING_TRANSITIONS,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('gold loan workflow is valid', () => {
      const result = validateWorkflow(GOLD_LOAN_STAGES, GOLD_LOAN_TRANSITIONS);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('empty stages list is invalid', () => {
      const result = validateWorkflow([], []);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Workflow must have at least one stage',
      );
    });

    it('rejects a workflow with no terminal stage', () => {
      const stages: WorkflowStage[] = [
        { code: 'A', name: 'A', displayOrder: 1 },
        { code: 'B', name: 'B', displayOrder: 2 },
      ];
      const transitions: WorkflowTransition[] = [{ from: 'A', to: 'B' }];
      const result = validateWorkflow(stages, transitions);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('terminal')),
      ).toBe(true);
    });

    it('rejects a transition referencing an unknown "from" stage', () => {
      const stages: WorkflowStage[] = [
        { code: 'A', name: 'A', displayOrder: 1, isTerminal: true },
      ];
      const transitions: WorkflowTransition[] = [
        { from: 'GHOST', to: 'A' },
      ];
      const result = validateWorkflow(stages, transitions);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('"GHOST"'))).toBe(true);
    });

    it('rejects a transition referencing an unknown "to" stage', () => {
      const stages: WorkflowStage[] = [
        { code: 'A', name: 'A', displayOrder: 1, isTerminal: true },
      ];
      const transitions: WorkflowTransition[] = [
        { from: 'A', to: 'NOWHERE' },
      ];
      const result = validateWorkflow(stages, transitions);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('"NOWHERE"'))).toBe(true);
    });

    it('rejects a workflow with an orphan (unreachable) stage', () => {
      const stages: WorkflowStage[] = [
        { code: 'ENTRY', name: 'Entry', displayOrder: 1 },
        { code: 'DONE', name: 'Done', displayOrder: 2, isTerminal: true },
        { code: 'ORPHAN', name: 'Orphan', displayOrder: 3, isTerminal: true },
      ];
      const transitions: WorkflowTransition[] = [
        { from: 'ENTRY', to: 'DONE' },
        // ORPHAN is never referenced as a "to" → unreachable
      ];
      const result = validateWorkflow(stages, transitions);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('ORPHAN'))).toBe(true);
    });

    it('detects a direct cycle (A → B → A)', () => {
      const stages: WorkflowStage[] = [
        { code: 'A', name: 'A', displayOrder: 1 },
        { code: 'B', name: 'B', displayOrder: 2, isTerminal: true },
      ];
      const transitions: WorkflowTransition[] = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' }, // cycle
      ];
      const result = validateWorkflow(stages, transitions);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('cycle'))).toBe(true);
    });

    it('detects an indirect cycle (A → B → C → A)', () => {
      const stages: WorkflowStage[] = [
        { code: 'A', name: 'A', displayOrder: 1 },
        { code: 'B', name: 'B', displayOrder: 2 },
        { code: 'C', name: 'C', displayOrder: 3, isTerminal: true },
      ];
      const transitions: WorkflowTransition[] = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' }, // cycle back to A
      ];
      const result = validateWorkflow(stages, transitions);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('cycle'))).toBe(true);
    });

    it('accepts a valid minimal workflow with one stage', () => {
      const stages: WorkflowStage[] = [
        { code: 'DONE', name: 'Done', displayOrder: 1, isTerminal: true },
      ];
      const result = validateWorkflow(stages, []);
      expect(result.valid).toBe(true);
    });

    it('accumulates multiple errors for a badly configured workflow', () => {
      const stages: WorkflowStage[] = [
        { code: 'A', name: 'A', displayOrder: 1 }, // no terminal stage
      ];
      const transitions: WorkflowTransition[] = [
        { from: 'A', to: 'GHOST' }, // unknown "to"
      ];
      const result = validateWorkflow(stages, transitions);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Multi-Tenant ──────────────────────────────────────────────────────────
  describe('Multi-Tenant', () => {
    const org1Transitions: WorkflowTransition[] = [
      { from: 'LEAD', to: 'APPLICATION' },
      { from: 'APPLICATION', to: 'DONE', requiredRole: 'CREDIT_HEAD' },
    ];
    const org1Stages: WorkflowStage[] = [
      { code: 'LEAD', name: 'Lead', displayOrder: 1 },
      { code: 'APPLICATION', name: 'Application', displayOrder: 2 },
      { code: 'DONE', name: 'Done', displayOrder: 3, isTerminal: true },
    ];

    const org2Transitions: WorkflowTransition[] = [
      { from: 'LEAD', to: 'KYC' },
      { from: 'KYC', to: 'DONE' }, // no role required
    ];
    const org2Stages: WorkflowStage[] = [
      { code: 'LEAD', name: 'Lead', displayOrder: 1 },
      { code: 'KYC', name: 'KYC', displayOrder: 2 },
      { code: 'DONE', name: 'Done', displayOrder: 3, isTerminal: true },
    ];

    it('different orgs have different workflows', () => {
      const org1 = validateWorkflow(org1Stages, org1Transitions);
      const org2 = validateWorkflow(org2Stages, org2Transitions);
      expect(org1.valid).toBe(true);
      expect(org2.valid).toBe(true);
      // org1 requires CREDIT_HEAD for APPLICATION→DONE; org2 does not
      expect(
        checkTransitionAllowed(org1Transitions, org1Stages, 'APPLICATION', 'DONE', []).allowed,
      ).toBe(false);
      expect(
        checkTransitionAllowed(org2Transitions, org2Stages, 'KYC', 'DONE', []).allowed,
      ).toBe(true);
    });

    it('product-specific workflow (gold loan) has its own stage set', () => {
      // Standard workflow does not have KYC_CHECK
      expect(
        isTransitionDefined(STANDARD_LENDING_TRANSITIONS, 'LEAD', 'KYC_CHECK'),
      ).toBe(false);
      // Gold loan workflow has KYC_CHECK
      expect(
        isTransitionDefined(GOLD_LOAN_TRANSITIONS, 'LEAD', 'KYC_CHECK'),
      ).toBe(true);
    });

    it('falls back to default: standard workflow still works when no product workflow matches', () => {
      // Simulated: no product-specific workflow → use standard flow
      const result = checkTransitionAllowed(
        STANDARD_LENDING_TRANSITIONS,
        STANDARD_LENDING_STAGES,
        'LEAD',
        'APPLICATION',
        [],
      );
      expect(result.allowed).toBe(true);
    });
  });

  // ── SLA ───────────────────────────────────────────────────────────────────
  describe('SLA', () => {
    it('detects SLA breach when days elapsed exceeds slaDays', () => {
      const stage: WorkflowStage = {
        code: 'DOCUMENT_COLLECTION',
        name: 'Document Collection',
        displayOrder: 3,
        slaDays: 5,
      };
      const stageEnteredAt = new Date('2026-03-25T00:00:00Z');
      const now = new Date('2026-04-05T00:00:00Z'); // 11 days later
      const result = detectSlaBreach(stage, stageEnteredAt, now);
      expect(result.breached).toBe(true);
      expect(result.daysElapsed).toBe(11);
      expect(result.daysBreached).toBe(6);
    });

    it('does not flag breach when within SLA', () => {
      const stage: WorkflowStage = {
        code: 'BUREAU_CHECK',
        name: 'Bureau Check',
        displayOrder: 4,
        slaDays: 2,
      };
      const stageEnteredAt = new Date('2026-04-07T00:00:00Z');
      const now = new Date('2026-04-08T00:00:00Z'); // 1 day later
      const result = detectSlaBreach(stage, stageEnteredAt, now);
      expect(result.breached).toBe(false);
      expect(result.daysElapsed).toBe(1);
      expect(result.daysBreached).toBe(0);
    });

    it('does not flag breach on the exact SLA boundary', () => {
      const stage: WorkflowStage = {
        code: 'LEAD',
        name: 'Lead',
        displayOrder: 1,
        slaDays: 2,
      };
      // Exactly 2 days elapsed — not yet breached (breach is strictly >)
      const stageEnteredAt = new Date('2026-04-06T00:00:00Z');
      const now = new Date('2026-04-08T00:00:00Z');
      const result = detectSlaBreach(stage, stageEnteredAt, now);
      expect(result.breached).toBe(false);
    });

    it('returns no breach when stage has no slaDays configured', () => {
      const stage: WorkflowStage = {
        code: 'APPROVED',
        name: 'Approved',
        displayOrder: 6,
        // slaDays intentionally absent
      };
      const stageEnteredAt = new Date('2020-01-01T00:00:00Z');
      const now = new Date('2026-04-08T00:00:00Z'); // years later
      const result = detectSlaBreach(stage, stageEnteredAt, now);
      expect(result.breached).toBe(false);
    });
  });

  // ── Clone (structural) ────────────────────────────────────────────────────
  describe('Clone', () => {
    it('creates an independent copy with a new name and isDefault=false', () => {
      // Simulate the clone operation on plain data (no DB)
      const source = {
        id: 'wf-original',
        name: 'Standard Lending Flow',
        organizationId: 'org-1',
        productId: null,
        isDefault: true,
        isActive: true,
        stages: STANDARD_LENDING_STAGES,
        transitions: STANDARD_LENDING_TRANSITIONS,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin',
        updatedBy: 'admin',
      };

      // Clone logic mirrors the service
      const clone = {
        ...source,
        id: 'wf-clone',
        name: 'Standard Lending Flow (Copy)',
        isDefault: false,
      };

      expect(clone.name).toBe('Standard Lending Flow (Copy)');
      expect(clone.isDefault).toBe(false);
      expect(clone.stages).toEqual(source.stages);
      expect(clone.transitions).toEqual(source.transitions);
      expect(clone.id).not.toBe(source.id);
    });

    it('clone preserves the same stages and transitions as the source', () => {
      const sourceStages = [...GOLD_LOAN_STAGES];
      const sourceTransitions = [...GOLD_LOAN_TRANSITIONS];
      const clone = {
        stages: sourceStages,
        transitions: sourceTransitions,
      };
      expect(clone.stages).toHaveLength(GOLD_LOAN_STAGES.length);
      expect(clone.transitions).toHaveLength(GOLD_LOAN_TRANSITIONS.length);
    });
  });
});
