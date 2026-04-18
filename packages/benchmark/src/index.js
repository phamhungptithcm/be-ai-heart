export function compareBenchmarkRuns(baseline, assisted) {
  const token_savings_pct = percentReduction(baseline.tokens, assisted.tokens);
  const time_savings_pct = percentReduction(baseline.minutes, assisted.minutes);
  const duplicate_reduction_pct = percentReduction(baseline.duplicates, assisted.duplicates);
  const policy_violation_reduction_pct = percentReduction(
    baseline.policy_violations,
    assisted.policy_violations,
  );
  const review_edit_reduction_pct = percentReduction(baseline.review_edits, assisted.review_edits);

  return {
    baseline,
    assisted,
    token_savings_pct,
    time_savings_pct,
    duplicate_reduction_pct,
    policy_violation_reduction_pct,
    review_edit_reduction_pct,
    summary: `Token usage improved by ${token_savings_pct}% and review edits improved by ${review_edit_reduction_pct}%.`,
  };
}

function percentReduction(before, after) {
  if (before === 0) {
    return 0;
  }

  return Math.round(((before - after) / before) * 100);
}
