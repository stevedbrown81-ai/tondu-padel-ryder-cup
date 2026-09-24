export function setWins(sets = []) {
  return sets.reduce((wins, set) => {
    if (set.a > set.b) wins.a += 1;
    if (set.b > set.a) wins.b += 1;
    return wins;
  }, { a: 0, b: 0 });
}

export function winnerOf(sets = []) {
  const wins = setWins(sets);
  if (wins.a === 2) return "a";
  if (wins.b === 2) return "b";
  return null;
}

function isWholeScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= 99;
}

function validateOpeningSet(set) {
  if (!isWholeScore(set?.a) || !isWholeScore(set?.b)) return "Enter whole game scores between 0 and 99.";
  if (set.a === set.b) return "A completed set cannot be tied.";
  const high = Math.max(set.a, set.b);
  const low = Math.min(set.a, set.b);
  if (high === 6 && low <= 4) return null;
  if (high === 7 && (low === 5 || low === 6)) return null;
  return "Sets 1 and 2 must finish 6–0 to 6–4, 7–5, or 7–6.";
}

function validateDecidingSet(set) {
  if (!isWholeScore(set?.a) || !isWholeScore(set?.b)) return "Enter whole game scores between 0 and 99.";
  if (set.a === set.b) return "A completed set cannot be tied.";
  const high = Math.max(set.a, set.b);
  const low = Math.min(set.a, set.b);
  if (high === 7 && low <= 5) return null;
  if (high > 7 && high - low === 2) return null;
  return "The third set is first to 7, with a lead of 2 games.";
}

export function validateMatchSets(sets) {
  if (!Array.isArray(sets) || (sets.length !== 2 && sets.length !== 3)) {
    return { valid: false, error: "Enter two sets for a 2–0 result, or three sets for a 2–1 result." };
  }

  for (let index = 0; index < sets.length; index += 1) {
    const error = index < 2 ? validateOpeningSet(sets[index]) : validateDecidingSet(sets[index]);
    if (error) return { valid: false, error: `Set ${index + 1}: ${error}` };
  }

  const afterTwo = setWins(sets.slice(0, 2));
  if (sets.length === 2 && afterTwo.a !== 2 && afterTwo.b !== 2) {
    return { valid: false, error: "A third set is required when the first two sets are split." };
  }
  if (sets.length === 3 && (afterTwo.a === 2 || afterTwo.b === 2)) {
    return { valid: false, error: "Do not enter a third set after a pair has already won the first two." };
  }

  const winner = winnerOf(sets);
  if (!winner) return { valid: false, error: "The result must produce a winner with two sets." };
  return { valid: true, winner };
}
