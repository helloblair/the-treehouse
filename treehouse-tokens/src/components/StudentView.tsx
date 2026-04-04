import { useCallback, useState } from 'react'
import type { Assignment, Submission, Transaction, Wallet, Reward } from '../types.ts'
import { RewardShop } from './RewardShop.tsx'
import { TransactionList } from './TransactionList.tsx'
import { Leaderboard } from './Leaderboard.tsx'

interface Props {
  wallet: Wallet
  assignments: Assignment[]
  submissions: Submission[]
  transactions: Transaction[]
  rewards: Reward[]
  leaderboard: { display_name: string; lifetime_earned: number }[]
  onSubmit: (assignmentId: string, notes: string) => Promise<void>
  onRedeem: (reward: Reward) => Promise<void>
  animatingBalance: boolean
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

type SubStatus = 'not_started' | 'pending' | 'approved' | 'rejected'

function getStatus(assignment: Assignment, submissions: Submission[]): SubStatus {
  const sub = submissions.find((s) => s.assignment_id === assignment.id)
  if (!sub) return 'not_started'
  return sub.status
}

const STATUS_BADGE: Record<SubStatus, { label: string; className: string }> = {
  not_started: { label: 'Not started', className: 'badge-neutral' },
  pending: { label: 'Pending review', className: 'badge-pending' },
  approved: { label: 'Approved', className: 'badge-approved' },
  rejected: { label: 'Rejected — resubmit', className: 'badge-rejected' },
}

export function StudentView({
  wallet,
  assignments,
  submissions,
  transactions,
  rewards,
  leaderboard,
  onSubmit,
  onRedeem,
  animatingBalance,
}: Props) {
  const [tab, setTab] = useState<'assignments' | 'rewards' | 'history' | 'leaderboard'>('assignments')
  const [submitNotes, setSubmitNotes] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  const handleSubmit = useCallback(async (assignmentId: string) => {
    setSubmitting(assignmentId)
    try {
      await onSubmit(assignmentId, submitNotes[assignmentId] || '')
      setSubmitNotes((prev) => ({ ...prev, [assignmentId]: '' }))
    } finally {
      setSubmitting(null)
    }
  }, [onSubmit, submitNotes])

  return (
    <div className="tokens-app">
      {/* Balance header */}
      <div className="balance-header">
        <div className="balance-coin">
          <span className="coin-icon">{'\u2B50'}</span>
          <span className={`balance-number${animatingBalance ? ' pop' : ''}`}>
            {wallet.balance}
          </span>
        </div>
        <div className="balance-label">tokens</div>
        <div className="lifetime">Lifetime earned: {wallet.lifetime_earned}</div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {(['assignments', 'rewards', 'history', 'leaderboard'] as const).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'assignments' ? 'Work' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'assignments' && (
          <div className="assignments-list">
            {assignments.filter((a) => a.status === 'active').length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">{'\uD83D\uDCDA'}</span>
                <p>No assignments yet!</p>
                <p className="hint">Your teacher will post work here.</p>
              </div>
            ) : (
              assignments
                .filter((a) => a.status === 'active')
                .map((assignment) => {
                  const status = getStatus(assignment, submissions)
                  const badge = STATUS_BADGE[status]
                  const sub = submissions.find((s) => s.assignment_id === assignment.id)
                  const canSubmit = status === 'not_started' || status === 'rejected'

                  return (
                    <div key={assignment.id} className="assignment-card">
                      <div className="assignment-header">
                        <span className="assignment-subject">{assignment.subject}</span>
                        <span className={`badge ${badge.className}`}>{badge.label}</span>
                      </div>
                      <div className="assignment-title">{assignment.title}</div>
                      {assignment.description && (
                        <div className="assignment-desc">{assignment.description}</div>
                      )}
                      <div className="assignment-meta">
                        <span className="assignment-reward">{'\u2B50'} {assignment.token_value} tokens</span>
                        {assignment.due_date && (
                          <span className="assignment-due">Due {timeAgo(assignment.due_date)}</span>
                        )}
                      </div>

                      {/* Rejection feedback */}
                      {status === 'rejected' && sub?.teacher_notes && (
                        <div className="teacher-feedback">
                          <strong>Teacher feedback:</strong> {sub.teacher_notes}
                        </div>
                      )}

                      {/* Submit area */}
                      {canSubmit && (
                        <div className="submit-area">
                          <input
                            type="text"
                            placeholder="Add a note (optional)"
                            value={submitNotes[assignment.id] || ''}
                            onChange={(e) =>
                              setSubmitNotes((prev) => ({ ...prev, [assignment.id]: e.target.value }))
                            }
                            className="submit-input"
                          />
                          <button
                            className="submit-btn"
                            disabled={submitting === assignment.id}
                            onClick={() => handleSubmit(assignment.id)}
                          >
                            {submitting === assignment.id ? 'Submitting...' : status === 'rejected' ? 'Resubmit' : 'Submit'}
                          </button>
                        </div>
                      )}

                      {status === 'pending' && (
                        <div className="pending-note">Waiting for teacher review...</div>
                      )}
                      {status === 'approved' && (
                        <div className="approved-note">{'\u2705'} Earned {assignment.token_value} tokens!</div>
                      )}
                    </div>
                  )
                })
            )}
          </div>
        )}

        {tab === 'rewards' && (
          <RewardShop wallet={wallet} rewards={rewards} onRedeem={onRedeem} />
        )}

        {tab === 'history' && <TransactionList transactions={transactions} />}

        {tab === 'leaderboard' && <Leaderboard entries={leaderboard} />}
      </div>
    </div>
  )
}
