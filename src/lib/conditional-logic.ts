import type { ConditionalRule, InspectionResponse } from "@/lib/types";

/**
 * Evaluate whether a question should be shown based on its conditional rules.
 * Returns true if the question should be displayed.
 */
export function shouldShowQuestion(
  rules: ConditionalRule[] | null | undefined,
  responses: Record<string, Pick<InspectionResponse, "value">>
): boolean {
  if (!rules || rules.length === 0) return true;

  for (const rule of rules) {
    const { questionId, operator, value: expected } = rule.condition;
    if (!questionId) continue;

    const actual = responses[questionId]?.value;
    const actualStr = String(actual ?? "");
    const expectedStr = String(expected ?? "");

    let conditionMet = false;
    switch (operator) {
      case "equals":
        conditionMet = actualStr === expectedStr;
        break;
      case "not_equals":
        conditionMet = actualStr !== expectedStr;
        break;
      case "contains":
        conditionMet = actualStr.toLowerCase().includes(expectedStr.toLowerCase());
        break;
      case "greater_than":
        conditionMet = parseFloat(actualStr) > parseFloat(expectedStr);
        break;
      case "less_than":
        conditionMet = parseFloat(actualStr) < parseFloat(expectedStr);
        break;
      default:
        conditionMet = actualStr === expectedStr;
    }

    if (conditionMet) {
      if (rule.action.type === "hide") return false;
      // "show" action: question visible only when condition met
    } else {
      if (rule.action.type === "show") return false;
    }
  }

  return true;
}

/**
 * Check if a question requires a note based on conditional rules.
 */
export function requiresNote(
  rules: ConditionalRule[] | null | undefined,
  responses: Record<string, Pick<InspectionResponse, "value">>
): boolean {
  if (!rules) return false;
  return rules.some((rule) => {
    if (rule.action.type !== "require_note") return false;
    const actual = String(responses[rule.condition.questionId]?.value ?? "");
    const expected = String(rule.condition.value ?? "");
    return checkCondition(rule.condition.operator, actual, expected);
  });
}

/**
 * Check if a response value should trigger auto-flagging.
 */
export function shouldAutoFlag(
  options: { text: string; flagged?: boolean }[] | undefined,
  value: unknown
): boolean {
  if (!options) return false;
  if (Array.isArray(value)) {
    return value.some((v) => options.find((o) => o.text === v)?.flagged);
  }
  return !!options.find((o) => o.text === value)?.flagged;
}

function checkCondition(operator: string, actual: string, expected: string): boolean {
  switch (operator) {
    case "equals": return actual === expected;
    case "not_equals": return actual !== expected;
    case "contains": return actual.toLowerCase().includes(expected.toLowerCase());
    case "greater_than": return parseFloat(actual) > parseFloat(expected);
    case "less_than": return parseFloat(actual) < parseFloat(expected);
    default: return actual === expected;
  }
}
