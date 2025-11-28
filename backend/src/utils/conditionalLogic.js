export function shouldShowQuestion(rules, answersSoFar) {
  if (!rules) return true;
  const { logic = "AND", conditions = [] } = rules;
  if (!Array.isArray(conditions) || conditions.length === 0) return true;

  const evalCondition = (condition) => {
    if (!condition || !condition.questionKey || !condition.operator) return true;
    const value = answersSoFar?.[condition.questionKey];
    const target = condition.value;

    switch (condition.operator) {
      case "equals":
        return value === target;
      case "notEquals":
        return value !== target;
      case "contains":
        if (Array.isArray(value)) {
          return value.includes(target);
        }
        if (typeof value === "string") {
          return value.includes(String(target));
        }
        return false;
      default:
        return true;
    }
  };

  const results = conditions.map((c) => {
    try {
      return evalCondition(c);
    } catch {
      return false;
    }
  });

  if (logic === "OR") {
    return results.some(Boolean);
  }
  return results.every(Boolean);
}


