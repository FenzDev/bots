type MatchResult = {
  value: string;
  extracted: string;
};

export function matchPattern(
  input: string,
  pattern: string
): MatchResult | null {
  let inputPos = 0;
  let patternPos = 0;
  let extracted = "";

  while (patternPos < pattern.length) {
    const p = pattern[patternPos];

    // $ = extract the rest
    if (p === "$") {
      extracted = input.slice(inputPos);
      return {
        value: input,
        extracted,
      };
    }

    // * = wildcard
    if (p === "*") {
      const next = pattern[patternPos + 1];

      if (next === undefined) {
        inputPos = input.length;
        patternPos++;
        continue;
      }

      const nextIndex = input.indexOf(next, inputPos);

      if (nextIndex === -1) {
        return null;
      }

      inputPos = nextIndex;
      patternPos++;
      continue;
    }

    // Normal character
    if (input[inputPos] !== p) {
      return null;
    }

    inputPos++;
    patternPos++;
  }

  // Pattern must consume the entire input
  if (inputPos !== input.length) {
    return null;
  }

  return {
    value: input,
    extracted,
  };
}