import type { ParserClarificationQuestion, ParserValidationIssue } from "@/lib/parser/expense-types";

export function buildClarificationQuestions(issues: ParserValidationIssue[]): ParserClarificationQuestion[] {
  return issues
    .filter((issue) => issue.severity === "blocking")
    .map((issue, index) => ({
      id: `${issue.code}-${index + 1}`,
      question: questionForIssue(issue)
    }));
}

function questionForIssue(issue: ParserValidationIssue): string {
  if (issue.code === "total_mismatch") return `${issue.message} Should I use the stated total or the itemized total?`;
  if (issue.code === "missing_participants") return "Who should be included in this split, or how many people should I create generated participant labels for?";
  if (issue.code === "missing_amount") return "What was the total amount or itemized cost list for this expense?";
  if (issue.code === "unknown_exclusion_target") return `${issue.message} Which participant and item should the rule apply to?`;
  if (issue.code === "ambiguous_item_amounts") return `${issue.message} Can you give the amount for each affected item, such as drinks versus food?`;
  if (issue.code === "payer_mismatch") return `${issue.message} Which payer amounts should I use?`;
  return issue.message;
}
