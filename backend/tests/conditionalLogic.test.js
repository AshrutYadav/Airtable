import { shouldShowQuestion } from "../src/utils/conditionalLogic.js";

describe("shouldShowQuestion", () => {
  test("returns true when rules is null", () => {
    expect(shouldShowQuestion(null, {})).toBe(true);
  });

  test("AND logic with all true", () => {
    const rules = {
      logic: "AND",
      conditions: [
        { questionKey: "role", operator: "equals", value: "Engineer" },
        { questionKey: "experience", operator: "contains", value: "JS" }
      ]
    };
    const answers = { role: "Engineer", experience: "JS and React" };
    expect(shouldShowQuestion(rules, answers)).toBe(true);
  });

  test("AND logic with one false", () => {
    const rules = {
      logic: "AND",
      conditions: [
        { questionKey: "role", operator: "equals", value: "Engineer" },
        { questionKey: "experience", operator: "contains", value: "JS" }
      ]
    };
    const answers = { role: "Engineer", experience: "Python" };
    expect(shouldShowQuestion(rules, answers)).toBe(false);
  });

  test("OR logic with one true", () => {
    const rules = {
      logic: "OR",
      conditions: [
        { questionKey: "role", operator: "equals", value: "Engineer" },
        { questionKey: "role", operator: "equals", value: "Designer" }
      ]
    };
    const answers = { role: "Engineer" };
    expect(shouldShowQuestion(rules, answers)).toBe(true);
  });

  test("handles missing values safely", () => {
    const rules = {
      logic: "AND",
      conditions: [{ questionKey: "unknown", operator: "equals", value: "x" }]
    };
    const answers = {};
    expect(shouldShowQuestion(rules, answers)).toBe(false);
  });
});


