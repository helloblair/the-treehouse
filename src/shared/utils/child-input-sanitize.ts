/**
 * Input sanitization for child-generated content.
 * Strips profanity, slurs, and inappropriate content from user inputs
 * like pet names, party member names, assignment notes, etc.
 *
 * Philosophy: replace bad words with safe alternatives rather than blocking.
 * A child misspelling or testing boundaries shouldn't break the experience.
 */

const BLOCKED_PATTERNS: RegExp[] = [
  // Profanity
  /\bf+u+c+k+\w*/gi,
  /\bs+h+i+t+\w*/gi,
  /\bb+i+t+c+h+\w*/gi,
  /\ba+s+s+(?:hole|hat|wipe)?\b/gi,
  /\bd+a+m+n+\w*/gi,
  /\bh+e+l+l+\b/gi,
  /\bcrap+\w*/gi,
  /\bwtf\b/gi,
  /\bstfu\b/gi,
  /\blmao\b/gi,
  /\bd+i+c+k+\w*/gi,
  /\bp+e+n+i+s+\w*/gi,
  /\bvagina\w*/gi,
  /\bboob\w*/gi,
  /\bp+o+r+n+\w*/gi,
  /\bsex+\w*/gi,

  // Slurs (partial list — catches the most common ones)
  /\bn+i+g+g+\w*/gi,
  /\bf+a+g+g*(?:ot)?\b/gi,
  /\bretard\w*/gi,
  /\btranny\w*/gi,
  /\bspic\b/gi,
  /\bchink\b/gi,
  /\bkike\b/gi,

  // Drug references
  /\bweed\b/gi,
  /\bcocaine\b/gi,
  /\bheroin\b/gi,
  /\bmeth\b/gi,

  // Violence
  /\bkill\s+(your|my|the|a)\s*self/gi,
  /\bsuicide\b/gi,
]

/**
 * Sanitize a user-generated text input (pet name, party member name, etc.)
 * Returns the cleaned string with inappropriate content replaced by asterisks.
 */
export function sanitizeChildInput(input: string): string {
  let result = input
  for (const pattern of BLOCKED_PATTERNS) {
    result = result.replace(pattern, (match) => '*'.repeat(match.length))
  }
  return result.trim()
}

/**
 * Validate a name input (pet name, party member name).
 * Returns { valid, sanitized, reason }.
 */
export function validateChildName(name: string, maxLength = 20): {
  valid: boolean
  sanitized: string
  reason?: string
} {
  if (!name || name.trim().length === 0) {
    return { valid: false, sanitized: '', reason: 'Name cannot be empty' }
  }

  const trimmed = name.trim().slice(0, maxLength)
  const sanitized = sanitizeChildInput(trimmed)

  // If sanitization changed the name significantly, it was inappropriate
  if (sanitized.includes('***')) {
    return { valid: false, sanitized, reason: 'Please choose a different name' }
  }

  return { valid: true, sanitized }
}
