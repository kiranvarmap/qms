import type { TemplateSection, TemplateQuestion, InspectionResponse } from "@/lib/types";

/**
 * Pure scoring function — extracted from submit route so it can be unit-tested.
 * Supports per-option custom scores, multiple_selection, and table scoring.
 * Returns a score 0–100, or null if totalWeight is 0.
 */
export function calculateScore(
  sections: TemplateSection[],
  responses: Pick<InspectionResponse, "questionId" | "value">[]
): number | null {
  let totalWeight = 0;
  let passedWeight = 0;

  for (const section of sections) {
    for (const q of section.questions as TemplateQuestion[]) {
      if (!q.scoring) continue;

      const response = responses.find((r) => r.questionId === q.id);
      const value = response?.value;

      totalWeight += q.weight;

      if (q.type === "yes_no_na") {
        if (value === "yes") passedWeight += q.weight;
        else if (value === "na") {
          totalWeight -= q.weight;
        }
      } else if (q.type === "checkbox") {
        if (value === true || value === "checked") passedWeight += q.weight;
      } else if (q.type === "rating") {
        const rating = typeof value === "number" ? Number(value) : parseInt(String(value)) || 0;
        passedWeight += (rating / 5) * q.weight;
      } else if (q.type === "multiple_choice" || q.type === "dropdown") {
        // Per-option scoring: if an option has a custom score, use it
        const selectedOpt = q.options?.find((o) => o.text === value);
        if (selectedOpt?.score !== undefined) {
          // Custom score: score/maxScore * weight
          const maxScore = Math.max(...(q.options?.map((o) => o.score ?? 0) ?? [1]), 1);
          passedWeight += maxScore > 0 ? (selectedOpt.score / maxScore) * q.weight : 0;
        } else if (value) {
          passedWeight += q.weight; // Answered = pass
        }
      } else if (q.type === "multiple_selection") {
        // Sum scores of all selected options
        const selected = Array.isArray(value) ? value : [];
        if (selected.length > 0 && q.options?.some((o) => o.score !== undefined)) {
          const totalOptionScore = selected.reduce((sum: number, val: string) => {
            const opt = q.options?.find((o) => o.text === val);
            return sum + (opt?.score ?? 0);
          }, 0);
          const maxScore = (q.options ?? []).reduce((sum, o) => sum + (o.score ?? 0), 0) || 1;
          passedWeight += (totalOptionScore / maxScore) * q.weight;
        } else if (selected.length > 0) {
          passedWeight += q.weight;
        }
      } else if (value !== null && value !== undefined && value !== "") {
        // Any answered question counts as pass for text/number/date/etc.
        passedWeight += q.weight;
      }
    }
  }

  return totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : null;
}

/** Determine pass/fail label from numeric score */
export function scoreLabel(score: number): "Pass" | "Needs Improvement" | "Fail" {
  if (score >= 80) return "Pass";
  if (score >= 50) return "Needs Improvement";
  return "Fail";
}

/** Map score to a CSS colour class */
export function scoreColorClass(score: number): "green" | "yellow" | "red" {
  if (score >= 80) return "green";
  if (score >= 50) return "yellow";
  return "red";
}
