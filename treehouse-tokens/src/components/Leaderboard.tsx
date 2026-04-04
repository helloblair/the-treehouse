interface Props {
  entries: { display_name: string; lifetime_earned: number }[]
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
          <span className="lb-name">{entry.display_name}</span>
          <span className="lb-tokens">{'\u2B50'} {entry.lifetime_earned}</span>
        </div>
      ))}
    </div>
  )
}
