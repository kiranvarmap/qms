import { calculateScore, scoreLabel, scoreColorClass } from "@/lib/scoring";
import type { TemplateSection, QuestionType } from "@/lib/types";

// ── helpers ─────────────────────────────────────────────────────────────────
function makeSection(questions: Partial<{
  id: string;
  type: string;
  scoring: boolean;
  weight: number;
}>[]): TemplateSection {
  return {
    id: "sec-1",
    templateId: "tmpl-1",
    title: "General",
    position: 0,
    pageNumber: 1,
    isRepeatable: false,
    maxRepetitions: null,
    requiresSignoff: false,
    signoffRoles: null,
    questions: questions.map((q, i) => ({
      id: q.id ?? `q-${i}`,
      sectionId: "sec-1",
      title: `Q${i}`,
      description: null,
      type: (q.type ?? "yes_no_na") as QuestionType,
      required: false,
      scoring: q.scoring ?? true,
      weight: q.weight ?? 1,
      options: [],
      position: i,
      conditionalRules: null,
      flagRules: null,
      linkedQuestionId: null,
      instructions: null,
    })),
  };
}

function resp(questionId: string, value: unknown) {
  return { questionId, value };
}

// ── calculateScore ───────────────────────────────────────────────────────────

describe("calculateScore", () => {
  test("returns null when no scoring questions exist", () => {
    const sec = makeSection([{ scoring: false }]);
    expect(calculateScore([sec], [])).toBeNull();
  });

  test("returns null when sections array is empty", () => {
    expect(calculateScore([], [])).toBeNull();
  });

  describe("yes_no_na questions", () => {
    test("all yes → 100%", () => {
      const sec = makeSection([
        { id: "q1", type: "yes_no_na", weight: 1 },
        { id: "q2", type: "yes_no_na", weight: 1 },
      ]);
      const responses = [resp("q1", "yes"), resp("q2", "yes")];
      expect(calculateScore([sec], responses)).toBe(100);
    });

    test("all no → 0%", () => {
      const sec = makeSection([
        { id: "q1", type: "yes_no_na", weight: 1 },
        { id: "q2", type: "yes_no_na", weight: 1 },
      ]);
      const responses = [resp("q1", "no"), resp("q2", "no")];
      expect(calculateScore([sec], responses)).toBe(0);
    });

    test("50/50 yes/no → 50%", () => {
      const sec = makeSection([
        { id: "q1", type: "yes_no_na", weight: 1 },
        { id: "q2", type: "yes_no_na", weight: 1 },
      ]);
      const responses = [resp("q1", "yes"), resp("q2", "no")];
      expect(calculateScore([sec], responses)).toBe(50);
    });

    test("N/A is excluded from denominator", () => {
      const sec = makeSection([
        { id: "q1", type: "yes_no_na", weight: 1 },
        { id: "q2", type: "yes_no_na", weight: 1 },
        { id: "q3", type: "yes_no_na", weight: 1 },
      ]);
      // q1=yes, q2=na, q3=no → effective weight = 2, passed = 1 → 50%
      const responses = [resp("q1", "yes"), resp("q2", "na"), resp("q3", "no")];
      expect(calculateScore([sec], responses)).toBe(50);
    });

    test("all N/A → returns null (zero denominator)", () => {
      const sec = makeSection([
        { id: "q1", type: "yes_no_na", weight: 1 },
      ]);
      expect(calculateScore([sec], [resp("q1", "na")])).toBeNull();
    });

    test("weighted questions — higher weight has more impact", () => {
      const sec = makeSection([
        { id: "q1", type: "yes_no_na", weight: 3 },
        { id: "q2", type: "yes_no_na", weight: 1 },
      ]);
      // q1=yes (w=3), q2=no (w=1) → 3/4 = 75%
      const responses = [resp("q1", "yes"), resp("q2", "no")];
      expect(calculateScore([sec], responses)).toBe(75);
    });
  });

  describe("rating questions", () => {
    test("rating 5/5 → full weight = 100%", () => {
      const sec = makeSection([{ id: "q1", type: "rating", weight: 1 }]);
      expect(calculateScore([sec], [resp("q1", 5)])).toBe(100);
    });

    test("rating 0/5 → 0%", () => {
      const sec = makeSection([{ id: "q1", type: "rating", weight: 1 }]);
      expect(calculateScore([sec], [resp("q1", 0)])).toBe(0);
    });

    test("rating 3/5 → 60%", () => {
      const sec = makeSection([{ id: "q1", type: "rating", weight: 1 }]);
      expect(calculateScore([sec], [resp("q1", 3)])).toBe(60);
    });

    test("missing rating treated as 0", () => {
      const sec = makeSection([{ id: "q1", type: "rating", weight: 1 }]);
      expect(calculateScore([sec], [])).toBe(0);
    });
  });

  describe("checkbox questions", () => {
    test('value "checked" → pass', () => {
      const sec = makeSection([{ id: "q1", type: "checkbox", weight: 1 }]);
      expect(calculateScore([sec], [resp("q1", "checked")])).toBe(100);
    });

    test("value true → pass", () => {
      const sec = makeSection([{ id: "q1", type: "checkbox", weight: 1 }]);
      expect(calculateScore([sec], [resp("q1", true)])).toBe(100);
    });

    test("empty value → fail", () => {
      const sec = makeSection([{ id: "q1", type: "checkbox", weight: 1 }]);
      expect(calculateScore([sec], [resp("q1", "")])).toBe(0);
    });
  });

  describe("text/number/date questions", () => {
    test("any non-empty answer → pass", () => {
      const sec = makeSection([{ id: "q1", type: "text", weight: 1 }]);
      expect(calculateScore([sec], [resp("q1", "some text")])).toBe(100);
    });

    test("empty string → fail", () => {
      const sec = makeSection([{ id: "q1", type: "text", weight: 1 }]);
      expect(calculateScore([sec], [resp("q1", "")])).toBe(0);
    });

    test("unanswered → fail", () => {
      const sec = makeSection([{ id: "q1", type: "number", weight: 1 }]);
      expect(calculateScore([sec], [])).toBe(0);
    });
  });

  describe("non-scoring questions are ignored", () => {
    test("scoring=false questions don't affect score", () => {
      const sec = makeSection([
        { id: "q1", type: "yes_no_na", scoring: true, weight: 1 },
        { id: "q2", type: "yes_no_na", scoring: false, weight: 1 },
      ]);
      // q2 is not scored — only q1 counts, q1=yes → 100%
      const responses = [resp("q1", "yes"), resp("q2", "no")];
      expect(calculateScore([sec], responses)).toBe(100);
    });
  });

  describe("multiple sections", () => {
    test("calculates across multiple sections", () => {
      const sec1: TemplateSection = {
        id: "sec-1", templateId: "t1", title: "S1", position: 0, pageNumber: 1, isRepeatable: false, maxRepetitions: null, requiresSignoff: false, signoffRoles: null,
        questions: [{ id: "q1", sectionId: "sec-1", title: "Q1", description: null, type: "yes_no_na", required: false, scoring: true, weight: 1, options: [], position: 0, conditionalRules: null, flagRules: null, linkedQuestionId: null, instructions: null }],
      };
      const sec2: TemplateSection = {
        id: "sec-2", templateId: "t1", title: "S2", position: 1, pageNumber: 1, isRepeatable: false, maxRepetitions: null, requiresSignoff: false, signoffRoles: null,
        questions: [{ id: "q2", sectionId: "sec-2", title: "Q2", description: null, type: "yes_no_na", required: false, scoring: true, weight: 1, options: [], position: 0, conditionalRules: null, flagRules: null, linkedQuestionId: null, instructions: null }],
      };
      // q1=yes, q2=no → 50%
      expect(calculateScore([sec1, sec2], [resp("q1", "yes"), resp("q2", "no")])).toBe(50);
    });
  });
});

// ── scoreLabel ───────────────────────────────────────────────────────────────

describe("scoreLabel", () => {
  test("100 → Pass", () => expect(scoreLabel(100)).toBe("Pass"));
  test("80 → Pass", () => expect(scoreLabel(80)).toBe("Pass"));
  test("79 → Needs Improvement", () => expect(scoreLabel(79)).toBe("Needs Improvement"));
  test("50 → Needs Improvement", () => expect(scoreLabel(50)).toBe("Needs Improvement"));
  test("49 → Fail", () => expect(scoreLabel(49)).toBe("Fail"));
  test("0 → Fail", () => expect(scoreLabel(0)).toBe("Fail"));
});

// ── scoreColorClass ──────────────────────────────────────────────────────────

describe("scoreColorClass", () => {
  test("≥80 → green", () => expect(scoreColorClass(80)).toBe("green"));
  test("50–79 → yellow", () => expect(scoreColorClass(65)).toBe("yellow"));
  test("<50 → red", () => expect(scoreColorClass(30)).toBe("red"));
});
