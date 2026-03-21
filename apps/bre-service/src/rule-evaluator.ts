/**
 * Pure function rule evaluator for the Business Rule Engine.
 *
 * Supports operators: EQ, NEQ, GT, GTE, LT, LTE, IN, NOT_IN, BETWEEN
 */

export type RuleOperator =
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'IN'
  | 'NOT_IN'
  | 'BETWEEN';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: number | string | boolean | number[] | string[] | [number, number];
}

export interface EvaluationContext {
  [key: string]: number | string | boolean | undefined;
}

export interface EvaluationResult {
  passed: boolean;
  reason: string;
}

/**
 * Evaluates a single rule condition against a flat evaluation context.
 *
 * @param condition - The rule condition to evaluate
 * @param context   - Flat key-value map of evaluation context values
 * @returns EvaluationResult with passed flag and reason string
 */
export function evaluateCondition(
  condition: RuleCondition,
  context: EvaluationContext,
): EvaluationResult {
  const { field, operator, value } = condition;
  const contextValue = context[field];

  if (contextValue === undefined || contextValue === null) {
    return {
      passed: false,
      reason: `Field '${field}' not found in evaluation context`,
    };
  }

  switch (operator) {
    case 'EQ': {
      const passed = contextValue === value;
      return {
        passed,
        reason: passed
          ? `${field} = ${String(contextValue)} (expected: ${String(value)})`
          : `${field} is ${String(contextValue)}, expected ${String(value)}`,
      };
    }

    case 'NEQ': {
      const passed = contextValue !== value;
      return {
        passed,
        reason: passed
          ? `${field} = ${String(contextValue)} (not equal to: ${String(value)})`
          : `${field} is ${String(contextValue)}, must not be ${String(value)}`,
      };
    }

    case 'GT': {
      const numVal = Number(value);
      const numCtx = Number(contextValue);
      const passed = numCtx > numVal;
      return {
        passed,
        reason: passed
          ? `${field} = ${numCtx} > ${numVal}`
          : `${field} = ${numCtx}, must be > ${numVal}`,
      };
    }

    case 'GTE': {
      const numVal = Number(value);
      const numCtx = Number(contextValue);
      const passed = numCtx >= numVal;
      return {
        passed,
        reason: passed
          ? `${field} = ${numCtx} >= ${numVal}`
          : `${field} = ${numCtx}, must be >= ${numVal}`,
      };
    }

    case 'LT': {
      const numVal = Number(value);
      const numCtx = Number(contextValue);
      const passed = numCtx < numVal;
      return {
        passed,
        reason: passed
          ? `${field} = ${numCtx} < ${numVal}`
          : `${field} = ${numCtx}, must be < ${numVal}`,
      };
    }

    case 'LTE': {
      const numVal = Number(value);
      const numCtx = Number(contextValue);
      const passed = numCtx <= numVal;
      return {
        passed,
        reason: passed
          ? `${field} = ${numCtx} <= ${numVal}`
          : `${field} = ${numCtx}, must be <= ${numVal}`,
      };
    }

    case 'IN': {
      const arr = value as (number | string)[];
      const passed = arr.includes(contextValue as number | string);
      return {
        passed,
        reason: passed
          ? `${field} = ${String(contextValue)} is in [${arr.join(', ')}]`
          : `${field} = ${String(contextValue)}, must be one of [${arr.join(', ')}]`,
      };
    }

    case 'NOT_IN': {
      const arr = value as (number | string)[];
      const passed = !arr.includes(contextValue as number | string);
      return {
        passed,
        reason: passed
          ? `${field} = ${String(contextValue)} is not in [${arr.join(', ')}]`
          : `${field} = ${String(contextValue)}, must not be one of [${arr.join(', ')}]`,
      };
    }

    case 'BETWEEN': {
      const [low, high] = value as [number, number];
      const numCtx = Number(contextValue);
      const passed = numCtx >= low && numCtx <= high;
      return {
        passed,
        reason: passed
          ? `${field} = ${numCtx} is between ${low} and ${high}`
          : `${field} = ${numCtx}, must be between ${low} and ${high}`,
      };
    }

    default: {
      return {
        passed: false,
        reason: `Unknown operator: ${String(operator)}`,
      };
    }
  }
}
