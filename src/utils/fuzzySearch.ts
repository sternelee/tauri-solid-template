/**
 * Fuzzy Search Utility
 * Provides intelligent fuzzy search for applications and commands
 */

import Fuse from 'fuse.js';

export interface SearchableItem {
  id: string;
  title: string;
  subtitle?: string;
  keywords?: string[];
  type: string;
  [key: string]: any;
}

/**
 * Create a fuzzy search instance
 */
export function createFuzzySearch<T extends SearchableItem>(
  items: T[],
  options?: Fuse.IFuseOptions<T>
): Fuse<T> {
  const defaultOptions: Fuse.IFuseOptions<T> = {
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'subtitle', weight: 0.3 },
      { name: 'keywords', weight: 0.2 },
    ],
    threshold: 0.4, // Lower is more strict, higher is more fuzzy
    distance: 100,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 1,
    shouldSort: true,
    ...options,
  };

  return new Fuse(items, defaultOptions);
}

/**
 * Perform fuzzy search and return sorted results
 */
export function fuzzySearch<T extends SearchableItem>(
  query: string,
  items: T[],
  options?: Fuse.IFuseOptions<T>
): T[] {
  if (!query || query.trim() === '') {
    return items;
  }

  const fuse = createFuzzySearch(items, options);
  const results = fuse.search(query);
  
  return results.map(result => result.item);
}

/**
 * Calculate match score for highlighting
 */

// Scoring constants
const EXACT_MATCH_SCORE = 1.0;
const STARTS_WITH_SCORE = 0.9;
const CONTAINS_SCORE = 0.7;
const FUZZY_MATCH_MULTIPLIER = 0.5;

export function getMatchScore(
  query: string,
  text: string
): number {
  if (!query || !text) return 0;
  
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  
  // Exact match
  if (lowerText === lowerQuery) return EXACT_MATCH_SCORE;
  
  // Starts with query
  if (lowerText.startsWith(lowerQuery)) return STARTS_WITH_SCORE;
  
  // Contains query
  if (lowerText.includes(lowerQuery)) return CONTAINS_SCORE;
  
  // Check for fuzzy match (each character in query appears in text in order)
  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  
  if (queryIndex === lowerQuery.length) {
    // Score based on how condensed the match is
    return FUZZY_MATCH_MULTIPLIER * (queryIndex / text.length);
  }
  
  return 0;
}

/**
 * Get highlighted segments of text based on query
 */
export function getHighlightSegments(
  text: string,
  query: string
): Array<{ text: string; highlight: boolean }> {
  if (!query || !text) {
    return [{ text, highlight: false }];
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const segments: Array<{ text: string; highlight: boolean }> = [];
  
  let lastIndex = 0;
  let queryIndex = 0;
  
  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      // Add non-highlighted text before this match
      if (i > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, i),
          highlight: false,
        });
      }
      
      // Add highlighted character
      segments.push({
        text: text[i],
        highlight: true,
      });
      
      lastIndex = i + 1;
      queryIndex++;
    }
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      highlight: false,
    });
  }
  
  return segments;
}
