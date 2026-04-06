interface Props {
  entries: { display_name: string; lifetime_earned: number }[]
}

/**
 * Anonymize a display name to first initial + last initial (e.g. "Alice B." -> "A.B.")
 * Protects child identity on the leaderboard while keeping it recognizable to the child.
 */
function anonymize(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  const first = parts[0][0].toUpperCase()
  if (parts.length === 1) return `${first}.`
  const last = parts[parts.length - 1][0].toUpperCase()
  return `${first}.${last}.`
}

export function Leaderboard({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p>No classmates yet.</p>
      </div>
    )
  }

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49']

  return (
    <div className="leaderboard">
      {entries.map((entry, i) => (
        <div key={entry.display_name + i} className="leaderboard-row">
          <span className="lb-rank">{medals[i] ?? `#${i + 1}`}</span>
          <span className="lb-name">{anonymize(entry.display_name)}</span>
          <span className="lb-tokens">{'\u2B50'} {entry.lifetime_earned}</span>
        </div>
      ))}
    </div>
  )
}
