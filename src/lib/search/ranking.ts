/**
 * FixIt Contextual Search Ranking Engine
 * Deterministic scoring algorithm prioritizing semantic relevance over popularity.
 */

// 1. Normalization
export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove punctuation except hyphens
    .replace(/\s+/g, " "); // Collapse whitespace
}

// 2. Tokenization
export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

// 3. Levenshtein Distance (Fuzzy Match)
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function isFuzzyMatch(token: string, targetToken: string): boolean {
  if (token.length <= 3) return token === targetToken; // Exact only for short words
  const dist = levenshteinDistance(token, targetToken);
  return dist <= 1 || (token.length > 5 && dist <= 2);
}

// 4. Scoring Algorithm
export type MatchScore = {
  score: number;
  matchedFields: string[];
};

export type SearchableField = {
  name: string;
  value: string | null | undefined;
  weight: number; // Base weight for this field in the current context
};

/**
 * Ranks an item based on a search query.
 * @param query The user's raw search query
 * @param fields The fields to search within this item, with context-specific weights
 * @returns Score object (score 0 means no match)
 */
export function scoreItem(query: string, fields: SearchableField[]): MatchScore {
  const normQuery = normalizeText(query);
  if (!normQuery) return { score: 0, matchedFields: [] };

  const queryTokens = tokenize(normQuery);
  let totalScore = 0;
  const matchedFields = new Set<string>();

  for (const field of fields) {
    if (!field.value) continue;
    const normField = normalizeText(field.value);
    if (!normField) continue;

    let fieldScore = 0;

    // 1. Exact Match (Highest Priority)
    if (normField === normQuery) {
      fieldScore += 100 * field.weight;
      matchedFields.add(field.name);
    } 
    // 2. Prefix Match (Whole phrase starts with query)
    else if (normField.startsWith(normQuery)) {
      fieldScore += 80 * field.weight;
      matchedFields.add(field.name);
    }
    // 3. Token-by-token evaluation
    else {
      const fieldTokens = tokenize(normField);
      
      let tokensMatched = 0;
      for (const qToken of queryTokens) {
        let bestTokenScore = 0;
        
        for (const fToken of fieldTokens) {
          if (fToken === qToken) {
            bestTokenScore = Math.max(bestTokenScore, 60); // Token match
          } else if (fToken.startsWith(qToken)) {
            bestTokenScore = Math.max(bestTokenScore, 40); // Prefix token match
          } else if (qToken.length > 3 && fToken.includes(qToken)) {
            bestTokenScore = Math.max(bestTokenScore, 20); // Partial token match
          } else if (isFuzzyMatch(qToken, fToken)) {
            bestTokenScore = Math.max(bestTokenScore, 30); // Fuzzy match
          }
        }
        
        if (bestTokenScore > 0) {
          tokensMatched++;
          fieldScore += bestTokenScore * field.weight;
        }
      }

      // Boost if all query tokens matched
      if (tokensMatched > 0 && tokensMatched === queryTokens.length) {
        fieldScore += 20 * field.weight;
        matchedFields.add(field.name);
      }
    }

    totalScore += fieldScore;
  }

  return { 
    score: totalScore, 
    matchedFields: Array.from(matchedFields) 
  };
}
