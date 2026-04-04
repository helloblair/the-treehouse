import { useCallback, useState } from 'react'
import type { Assignment, PendingReview, StudentOverview } from '../types.ts'

interface Props {
  assignments: Assignment[]
  pendingReviews: PendingReview[]
  students: StudentOverview[]
  onCreateAssignment: (data: {
    title: string
    description: string
    subject: string
    token_value: number
    due_date: string | null
  }) => Promise<void>
  onApprove: (submissionId: string, notes: string) => Promise<void>
  onReject: (submissionId: string, notes: string) => Promise<void>
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

export function TeacherView({
  assignments,
  pendingReviews,
  students,
  onCreateAssignment,
  onApprove,
  onReject,
}: Props) {
  const [tab, setTab] = useState<'assignments' | 'reviews' | 'students'>('assignments')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // New assignment form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('math')
  const [tokenValue, setTokenValue] = useState(15)
  const [dueDate, setDueDate] = useState('')

  // Review notes
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return
    setCreating(true)
    try {
      await onCreateAssignment({
        title: title.trim(),
        description: description.trim(),
        subject,
        token_value: tokenValue,
        due_date: dueDate || null,
      })
      setTitle('')
      setDescription('')
      setSubject('math')
      setTokenValue(15)
      setDueDate('')
      setShowForm(false)
    } finally {
      setCreating(false)
    }
  }, [title, description, subject, tokenValue, dueDate, onCreateAssignment])

  const handleApprove = useCallback(async (subId: string) => {
    setProcessing(subId)
    try {
      await onApprove(subId, reviewNotes[subId] || '')
      setReviewNotes((prev) => ({ ...prev, [subId]: '' }))
    } finally {
      setProcessing(null)
    }
  }, [onApprove, reviewNotes])

  const handleReject = useCallback(async (subId: string) => {
    setProcessing(subId)
    try {
      await onReject(subId, reviewNotes[subId] || '')
      setReviewNotes((prev) => ({ ...prev, [subId]: '' }))
    } finally {
      setProcessing(null)
    }
  }, [onReject, reviewNotes])

  const SUBJECTS = ['math', 'reading', 'science', 'writing', 'art', 'social studies']

  return (
    <div className="tokens-app teacher">
      <div className="teacher-header">
        <span className="teacher-icon">{'\uD83C\uDF3F'}</span>
        <span className="teacher-title">Teacher Dashboard</span>
        {pendingReviews.length > 0 && (
          <span className="review-badge">{pendingReviews.length}</span>
        )}
      </div>

      <div className="tab-bar">
        <button className={tab === 'assignments' ? 'active' : ''} onClick={() => setTab('assignments')}>
          Assignments
        </button>
        <button className={tab === 'reviews' ? 'active' : ''} onClick={() => setTab('reviews')}>
          Reviews {pendingReviews.length > 0 && `(${pendingReviews.length})`}
        </button>
        <button className={tab === 'students' ? 'active' : ''} onClick={() => setTab('students')}>
          Students
        </button>
      </div>

      <div className="tab-content">
        {tab === 'assignments' && (
          <div className="teacher-assignments">
            <button className="new-assignment-btn" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ New Assignment'}
            </button>

            {showForm && (
              <div className="assignment-form">
                <input
                  type="text"
                  placeholder="Assignment title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-input"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-textarea"
                  rows={2}
                />
                <div className="form-row">
                  <select value={subject} onChange={(e) => setSubject(e.target.value)} className="form-select">
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                  <div className="token-input-group">
                    <span>{'\u2B50'}</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={tokenValue}
                      onChange={(e) => setTokenValue(Number(e.target.value))}
                      className="form-input-small"
                    />
                  </div>
                </div>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="form-input"
                  placeholder="Due date (optional)"
                />
                <button
                  className="create-btn"
                  disabled={!title.trim() || creating}
                  onClick={handleCreate}
                >
                  {creating ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            )}

            {assignments.length === 0 ? (
              <div className="empty-state">
                <p>No assignments yet. Create one above!</p>
              </div>
            ) : (
              assignments.map((a) => (
                <div key={a.id} className="assignment-card teacher-card">
                  <div className="assignment-header">
                    <span className="assignment-subject">{a.subject}</span>
                    <span className={`badge ${a.status === 'active' ? 'badge-approved' : 'badge-neutral'}`}>
                      {a.status}
                    </span>
                  </div>
                  <div className="assignment-title">{a.title}</div>
                  {a.description && <div className="assignment-desc">{a.description}</div>}
                  <div className="assignment-meta">
                    <span className="assignment-reward">{'\u2B50'} {a.token_value} tokens</span>
                    <span className="assignment-due">Created {timeAgo(a.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'reviews' && (
          <div className="reviews-list">
            {pendingReviews.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">{'\u2705'}</span>
                <p>All caught up! No submissions to review.</p>
              </div>
            ) : (
              pendingReviews.map((review) => (
                <div key={review.submission_id} className="review-card">
                  <div className="review-header">
                    <span className="review-student">{review.student_name}</span>
                    <span className="review-time">{timeAgo(review.submitted_at)}</span>
                  </div>
                  <div className="review-assignment">{review.assignment_title}</div>
                  <div className="review-meta">
                    <span className="assignment-subject">{review.subject}</span>
                    <span className="assignment-reward">{'\u2B50'} {review.token_value}</span>
                  </div>
                  {review.student_notes && (
                    <div className="review-notes">
                      <strong>Student notes:</strong> {review.student_notes}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Feedback (optional)"
                    value={reviewNotes[review.submission_id] || ''}
                    onChange={(e) =>
                      setReviewNotes((prev) => ({ ...prev, [review.submission_id]: e.target.value }))
                    }
                    className="submit-input"
                  />
                  <div className="review-actions">
                    <button
                      className="reject-btn"
                      disabled={processing === review.submission_id}
                      onClick={() => handleReject(review.submission_id)}
                    >
                      Reject
                    </button>
                    <button
                      className="approve-btn"
                      disabled={processing === review.submission_id}
                      onClick={() => handleApprove(review.submission_id)}
                    >
                      {'\u2705'} Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'students' && (
          <div className="students-list">
            {students.length === 0 ? (
              <div className="empty-state">
                <p>No students have signed in yet.</p>
              </div>
            ) : (
              students.map((s, i) => (
                <div key={s.display_name + i} className="student-row">
                  <span className="student-rank">#{i + 1}</span>
                  <span className="student-name">{s.display_name}</span>
                  <span className="student-balance">{'\u2B50'} {s.balance}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
