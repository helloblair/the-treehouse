import type { Transaction } from '../types.ts'

interface Props {
  transactions: Transaction[]
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function TransactionList({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <p>No transactions yet.</p>
      </div>
    )
  }

  return (
    <div className="tx-list">
      {transactions.map((tx) => (
        <div key={tx.id} className={`tx-row ${tx.type}`}>
          <span className="tx-icon">
            {tx.type === 'earn' ? '\uD83E\uDE99' : '\uD83C\uDF81'}
          </span>
          <div className="tx-info">
            {tx.subject && <span className="tx-subject">{tx.subject}</span>}
            <span className="tx-reason">{tx.reason}</span>
            <span className="tx-time">{timeAgo(tx.created_at)}</span>
          </div>
          <span className={`tx-amount ${tx.type}`}>
            {tx.type === 'earn' ? '+' : '-'}{tx.amount}
          </span>
        </div>
      ))}
    </div>
  )
}
