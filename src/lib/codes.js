// Suggests the 3-character Menu / Course code from a name, avoiding codes
// that are already taken. Codes become part of permanent work item IDs.
//
//   "Power BI"              → PBI   (acronym word kept whole + next initial)
//   "Performance Dashboard" → PDA   (first initial + two letters of the next word)
//   "Notification"          → NOT   (single word: first three letters)
//   "Super App Mobile"      → SAM   (three or more words: initials)
//   "ระบบแจ้งเตือน"           → M01   (no Latin letters: numbered fallback)

function words(name) {
  return String(name || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toUpperCase());
}

function isAcronym(word, original) {
  return word.length >= 2 && word.length <= 3 && original.includes(word);
}

function primaryCode(parts, original) {
  if (!parts.length) return "";
  if (parts.length >= 3) return parts.slice(0, 3).map((word) => word[0]).join("");
  const [first, second] = parts;
  if (!second) return first.slice(0, 3);
  if (isAcronym(first, original)) return (first + second).slice(0, 3);
  return (first[0] + second).slice(0, 3);
}

// Keep the first letter, then try every ordered pair of the remaining letters.
function alternatives(letters) {
  const result = [];
  for (let i = 1; i < letters.length; i += 1) {
    for (let j = i + 1; j < letters.length; j += 1) result.push(letters[0] + letters[i] + letters[j]);
  }
  return result;
}

export function suggestCode(name, takenCodes = [], fallbackPrefix = "M") {
  const taken = new Set([...takenCodes].map((code) => String(code).toUpperCase()));
  const free = (code) => code.length === 3 && !taken.has(code);
  const parts = words(name);
  const letters = parts.join("");

  if (letters) {
    const primary = primaryCode(parts, String(name || ""));
    const padded = primary.length === 3 ? primary : (primary + letters.slice(primary.length) + "XX").slice(0, 3);
    const candidates = [padded, ...alternatives(letters)];
    const found = candidates.find(free);
    if (found) return found;
    for (let digit = 1; digit <= 9; digit += 1) {
      const code = `${padded.slice(0, 2)}${digit}`;
      if (free(code)) return code;
    }
  }

  for (let number = 1; number <= 99; number += 1) {
    const code = `${fallbackPrefix}${String(number).padStart(2, "0")}`;
    if (free(code)) return code;
  }
  return "";
}
