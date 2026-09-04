export type DiffPart =
  | { type: "equal"; text: string }
  | { type: "remove"; text: string }
  | { type: "add"; text: string };

export function diffWords(oldText: string, newText: string): DiffPart[] {
  const oldWords = oldText.trim().split(/\s+/);
  const newWords = newText.trim().split(/\s+/);

  // Normalize only for comparison; preserve original text for output.
  const oldNormalized = oldWords.map(word => word.toLowerCase());
  const newNormalized = newWords.map(word => word.toLowerCase());

  const m = oldWords.length;
  const n = newWords.length;

  // Longest Common Subsequence
  const dp = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0)
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        oldNormalized[i] === newNormalized[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffPart[] = [];

  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (oldNormalized[i] === newNormalized[j]) {
      result.push({
        type: "equal",
        text: oldWords[i],
      });

      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({
        type: "remove",
        text: oldWords[i],
      });

      i++;
    } else {
      result.push({
        type: "add",
        text: newWords[j],
      });

      j++;
    }
  }

  while (i < m) {
    result.push({
      type: "remove",
      text: oldWords[i],
    });

    i++;
  }

  while (j < n) {
    result.push({
      type: "add",
      text: newWords[j],
    });

    j++;
  }

  // Merge consecutive changes.
  const merged: DiffPart[] = [];

  for (const part of result) {
    const last = merged[merged.length - 1];

    if (last?.type === part.type && part.type !== "equal") {
      last.text += ` ${part.text}`;
    } else {
      merged.push({ ...part });
    }
  }

  return merged.filter(diff => diff.text !== '');
}