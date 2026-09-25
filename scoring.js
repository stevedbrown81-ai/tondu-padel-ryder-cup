export function setWins(sets = []) {
  return sets.reduce((wins, set) => {
    if (set.a > set.b) wins.a += 1;
    if (set.b > set.a) wins.b += 1;
    return wins;
  }, { a: 0, b: 0 });
}

export function winnerOf(sets = []) {
  if (!Array.isArray(sets) || sets.length !== 2) return null;
  const wins = setWins(sets);
  if (wins.a === 2) return "a";
  if (wins.b === 2) return "b";
  if (wins.a === 1 && wins.b === 1) return "draw";
  return null;
}

export function matchPoints(sets = []) {
  const outcome = winnerOf(sets);
  if (outcome === "a") return { a: 1, b: 0 };
  if (outcome === "b") return { a: 0, b: 1 };
  if (outcome === "draw") return { a: 0.5, b: 0.5 };
  return { a: 0, b: 0 };
}

function isWholeScore(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validateMatchSets(sets) {
  if (!Array.isArray(sets) || sets.length !== 2) {
    return { valid: false, error: "Enter exactly two sets for the match." };
  }

  for (let index = 0; index < sets.length; index += 1) {
    const set = sets[index];
    if (!isWholeScore(set?.a) || !isWholeScore(set?.b)) {
      return { valid: false, error: `Set ${index + 1}: enter non-negative whole-number scores.` };
    }
    if (set.a === set.b) {
      return { valid: false, error: `Set ${index + 1}: the scores must be different so one side wins the set.` };
    }
  }

  return { valid: true, winner: winnerOf(sets) };
}
