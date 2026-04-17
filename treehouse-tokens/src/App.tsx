import { useCallback, useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { supabase } from './lib/supabase.ts'
import { StudentView } from './components/StudentView.tsx'
import { TeacherView } from './components/TeacherView.tsx'
import type { Assignment, Submission, Transaction, Wallet, Reward, PendingReview, StudentOverview } from './types.ts'
import './App.css'

const PLUGIN_ID = 'treehouse-tokens'
const PLATFORM_ORIGIN = (import.meta.env.VITE_PLATFORM_ORIGIN || 'http://localhost:1212').trim()

type ToolCallPayload = {
  type: 'TREEHOUSE_TOOL_CALL'
  pluginId: string
  payload: {
    callId: string
    toolName: string
    params: Record<string, unknown>
  }
}

// ── Helpers ──────────────────────────────────────────────────

function sendResult(callId: string, result: unknown, isError = false) {
  window.parent.postMessage(
    { type: 'TREEHOUSE_TOOL_RESULT', pluginId: PLUGIN_ID, payload: { callId, result, isError } },
    PLATFORM_ORIGIN,
  )
}

function sendStateToParent(wallet: Wallet, transactions: Transaction[]) {
  window.parent.postMessage(
    { type: 'TREEHOUSE_STATE_UPDATE', pluginId: PLUGIN_ID, payload: { state: { wallet, transactions } } },
    PLATFORM_ORIGIN,
  )
}

function fireConfetti() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#1E90FF'],
  })
}

// ── App ──────────────────────────────────────────────────────

function App() {
  const [role, setRole] = useState<'teacher' | 'student'>('student')
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, lifetime_earned: 0, redeemed_rewards: [] })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([])
  const [studentOverview, setStudentOverview] = useState<StudentOverview[]>([])
  const [leaderboard, setLeaderboard] = useState<{ display_name: string; lifetime_earned: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [animatingBalance, setAnimatingBalance] = useState(false)

  const walletRef = useRef(wallet)
  walletRef.current = wallet
  const userIdRef = useRef<string | null>(null)
  const roleRef = useRef(role)
  roleRef.current = role
  const initResolversRef = useRef<Array<() => void>>([])
  const refreshGenRef = useRef(0)

  // ── Load rewards.json ─────────────────────────────────────
  useEffect(() => {
    fetch('/rewards.json')
      .then((r) => r.json())
      .then((data: Reward[]) => setRewards(data))
      .catch(() => console.error('[treehouse-tokens] Failed to load rewards.json'))
  }, [])

  // ── Wait for init ─────────────────────────────────────────
  function waitForInit(): Promise<void> {
    if (userIdRef.current) return Promise.resolve()
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(), 5000)
      initResolversRef.current.push(() => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  // ── Data fetching ─────────────────────────────────────────

  const fetchWallet = useCallback(async (uid: string): Promise<Wallet> => {
    const { data, error } = await supabase
      .from('token_wallets')
      .select('balance, lifetime_earned, redeemed_rewards')
      .eq('user_id', uid)
      .single()
    if (error && error.code === 'PGRST116') {
      const { data: newWallet, error: insertErr } = await supabase
        .from('token_wallets')
        .insert({ user_id: uid })
        .select('balance, lifetime_earned, redeemed_rewards')
        .single()
      if (insertErr) throw insertErr
      return newWallet as Wallet
    }
    if (error) throw error
    return data as Wallet
  }, [])

  const fetchTransactions = useCallback(async (uid: string): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return (data ?? []) as Transaction[]
  }, [])

  const fetchAssignments = useCallback(async (): Promise<Assignment[]> => {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Assignment[]
  }, [])

  const fetchSubmissions = useCallback(async (uid: string): Promise<Submission[]> => {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select('*')
      .eq('student_id', uid)
    if (error) throw error
    return (data ?? []) as Submission[]
  }, [])

  const fetchPendingReviews = useCallback(async (): Promise<PendingReview[]> => {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select('id, assignment_id, student_id, student_notes, submitted_at, assignments(title, subject, token_value), user_profiles!assignment_submissions_student_id_fkey(display_name)')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((row: Record<string, unknown>) => {
      const a = row.assignments as Record<string, unknown> | null
      const p = row.user_profiles as Record<string, unknown> | null
      return {
        submission_id: row.id as string,
        assignment_id: row.assignment_id as string,
        assignment_title: (a?.title as string) ?? '',
        subject: (a?.subject as string) ?? '',
        token_value: (a?.token_value as number) ?? 0,
        student_name: (p?.display_name as string) ?? 'Unknown',
        student_notes: (row.student_notes as string) ?? '',
        submitted_at: row.submitted_at as string,
      }
    })
  }, [])

  const fetchStudentOverview = useCallback(async (): Promise<StudentOverview[]> => {
    const { data: wallets } = await supabase
      .from('token_wallets')
      .select('user_id, balance, lifetime_earned')
    const walletMap = new Map((wallets ?? []).map((w: Record<string, unknown>) => [w.user_id, w]))

    const { data: fullProfiles } = await supabase
      .from('user_profiles')
      .select('user_id, display_name')
      .eq('role', 'student')

    return (fullProfiles ?? []).map((p: Record<string, unknown>) => {
      const w = walletMap.get(p.user_id) as Record<string, unknown> | undefined
      return {
        display_name: p.display_name as string,
        balance: (w?.balance as number) ?? 0,
        lifetime_earned: (w?.lifetime_earned as number) ?? 0,
      }
    }).sort((a: StudentOverview, b: StudentOverview) => b.lifetime_earned - a.lifetime_earned)
  }, [])

  const fetchLeaderboard = useCallback(async (): Promise<{ display_name: string; lifetime_earned: number }[]> => {
    // Calls the SECURITY DEFINER RPC instead of joining user_profiles and
    // token_wallets directly. After the 20260408 lockdown, students no longer
    // have SELECT on every other student's profile or wallet — get_leaderboard
    // returns sanitized rows server-side.
    const { data, error } = await supabase.rpc('get_leaderboard', { p_limit: 20 })
    if (error) {
      console.warn('[treehouse-tokens] leaderboard fetch failed:', error)
      return []
    }
    return (data ?? []) as { display_name: string; lifetime_earned: number }[]
  }, [])

  const refreshStudentData = useCallback(async (uid: string) => {
    const gen = ++refreshGenRef.current
    const [w, txs, assigns, subs, lb] = await Promise.all([
      fetchWallet(uid),
      fetchTransactions(uid),
      fetchAssignments(),
      fetchSubmissions(uid),
      fetchLeaderboard(),
    ])
    // Discard results if a newer refresh started while we were fetching
    if (gen !== refreshGenRef.current) return { wallet: walletRef.current }
    setWallet(w)
    setTransactions(txs)
    setAssignments(assigns)
    setSubmissions(subs)
    setLeaderboard(lb)
    sendStateToParent(w, txs)
    return { wallet: w }
  }, [fetchWallet, fetchTransactions, fetchAssignments, fetchSubmissions, fetchLeaderboard])

  const refreshTeacherData = useCallback(async () => {
    const [assigns, reviews, students] = await Promise.all([
      fetchAssignments(),
      fetchPendingReviews(),
      fetchStudentOverview(),
    ])
    setAssignments(assigns)
    setPendingReviews(reviews)
    setStudentOverview(students)
  }, [fetchAssignments, fetchPendingReviews, fetchStudentOverview])

  // ── Tool call handler ─────────────────────────────────────

  const handleToolCall = useCallback(async (msg: ToolCallPayload) => {
    const { callId, toolName, params } = msg.payload

    // Handle init
    if (toolName === 'init_tokens') {
      const uid = params.userId as string
      const initRole = (params.role as string) === 'teacher' ? 'teacher' : 'student'
      userIdRef.current = uid
      setRole(initRole as 'teacher' | 'student')
      roleRef.current = initRole as 'teacher' | 'student'
      try {
        if (initRole === 'student') {
          await refreshStudentData(uid)
        } else {
          await refreshTeacherData()
        }
      } catch (err) {
        console.error('[treehouse-tokens] init error:', err)
      }
      setLoading(false)
      for (const resolve of initResolversRef.current) resolve()
      initResolversRef.current = []
      return
    }

    await waitForInit()
    const uid = userIdRef.current
    if (!uid) {
      sendResult(callId, { error: 'User not initialized' }, true)
      return
    }

    switch (toolName) {
      // ── Student tools ──
      case 'get_wallet': {
        try {
          const w = await fetchWallet(uid)
          setWallet(w)
          sendResult(callId, { balance: w.balance, lifetime_earned: w.lifetime_earned, redeemed_rewards: w.redeemed_rewards })
        } catch (err) {
          sendResult(callId, { error: String(err) }, true)
        }
        break
      }

      case 'get_my_assignments': {
        try {
          const [assigns, subs] = await Promise.all([fetchAssignments(), fetchSubmissions(uid)])
          setAssignments(assigns)
          setSubmissions(subs)
          const result = assigns.filter((a) => a.status === 'active').map((a) => {
            const sub = subs.find((s) => s.assignment_id === a.id)
            return {
              id: a.id,
              title: a.title,
              description: a.description,
              subject: a.subject,
              token_value: a.token_value,
              due_date: a.due_date,
              status: sub ? sub.status : 'not_started',
              teacher_notes: sub?.teacher_notes ?? null,
            }
          })
          sendResult(callId, { assignments: result })
        } catch (err) {
          sendResult(callId, { error: String(err) }, true)
        }
        break
      }

      case 'submit_assignment': {
        try {
          const { data, error } = await supabase.rpc('submit_assignment', {
            p_caller_id: uid,
            p_assignment_id: params.assignment_id as string,
            p_student_notes: (params.student_notes as string) || '',
          })
          if (error) throw error
          const result = data as Record<string, unknown>
          if (result.error) {
            sendResult(callId, result, true)
          } else {
            await refreshStudentData(uid)
            sendResult(callId, result)
          }
        } catch (err) {
          sendResult(callId, { error: String(err) }, true)
        }
        break
      }

      case 'get_transactions': {
        try {
          const txs = await fetchTransactions(uid)
          setTransactions(txs)
          sendResult(callId, {
            transactions: txs.map((t) => ({
              type: t.type, amount: t.amount, reason: t.reason,
              subject: t.subject, reward_id: t.reward_id, created_at: t.created_at,
            })),
          })
        } catch (err) {
          sendResult(callId, { error: String(err) }, true)
        }
        break
      }

      case 'get_rewards_catalog': {
        sendResult(callId, {
          rewards: rewards.map((r) => ({ id: r.id, name: r.name, cost: r.cost, type: r.type, description: r.description })),
        })
        break
      }

      case 'redeem_reward': {
        const rewardId = String(params.reward_id)
        const reward = rewards.find((r) => r.id === rewardId)
        if (!reward) {
          sendResult(callId, { error: `Unknown reward: ${rewardId}` }, true)
          break
        }
        // Balance check is handled atomically by the server RPC (redeem_reward).
        // No client-side guard — avoids false rejections from stale walletRef.
        try {
          const { data, error } = await supabase.rpc('redeem_reward', {
            p_user_id: uid,
            p_reward_id: reward.id,
            p_reward_name: reward.name,
            p_cost: reward.cost,
          })
          if (error) throw error
          const result = data as Record<string, unknown>
          if (result.error) {
            sendResult(callId, { error: result.error as string }, true)
            break
          }
          const { wallet: updatedWallet } = await refreshStudentData(uid)
          sendResult(callId, { success: true, redeemed: reward.name, cost: reward.cost, new_balance: updatedWallet.balance })
        } catch (err) {
          sendResult(callId, { error: String(err) }, true)
        }
        break
      }

      // ── Teacher tools ──
      case 'create_assignment': {
        try {
          const { data, error } = await supabase.rpc('create_assignment', {
            p_caller_id: uid,
            p_title: params.title as string,
            p_description: (params.description as string) || '',
            p_subject: params.subject as string,
            p_token_value: params.token_value as number,
            p_due_date: (params.due_date as string) || null,
          })
          if (error) throw error
          const result = data as Record<string, unknown>
          if (result.error) {
            sendResult(callId, result, true)
          } else {
            await refreshTeacherData()
            sendResult(callId, result)
          }
        } catch (err) {
          sendResult(callId, { error: String(err) }, true)
        }
        break
      }

      case 'get_pending_submissions': {
        try {
          const reviews = await fetchPendingReviews()
          setPendingReviews(reviews)
          sendResult(callId, { submissions: reviews })
        } catch (err) {
          sendResult(callId, { error: String(err) }, true)
        }
        break
      }

      case 'approve_submission': {
        try {
          const { data, error } = await supabase.rpc('approve_submission', {
            p_caller_id: uid,
            p_submission_id: params.submission_id as string,
            p_teacher_notes: (params.teacher_notes as string) || '',
          })
          if (error) throw error
          const result = data as Record<string, unknown>
          if (result.error) {
            sendResult(callId, result, true)
          } else {
            fireConfetti()
            await refreshTeacherData()
            sendResult(callId, result)
          }
        } catch (err) {
          sendResult(callId, { error: String(err) }, true)
        }
        break
      }

      case 'reject_submission': {
        try {
          const { data, error } = await supabase.rpc('reject_submission', {
            p_caller_id: uid,
            p_submission_id: params.submission_id as string,
            p_teacher_notes: (params.teacher_notes as string) || '',
          })
          if (error) throw error
          const result = data as Record<string, unknown>
          if (result.error) {
            sendResult(callId, result, true)
          } else {
            await refreshTeacherData()
            sendResult(callId, result)
          }
        } catch (err) {
          sendResult(callId, { error: String(err) }, true)
        }
        break
      }

      default:
        sendResult(callId, { error: `Unknown tool: ${toolName}` }, true)
    }
  }, [fetchWallet, fetchTransactions, fetchAssignments, fetchSubmissions, fetchPendingReviews, refreshStudentData, refreshTeacherData, rewards])

  // ── PostMessage listener ──────────────────────────────────

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (PLATFORM_ORIGIN !== '*' && event.origin !== PLATFORM_ORIGIN) return
      const data = event.data
      if (data?.type === 'TREEHOUSE_TOOL_CALL' && data?.pluginId === PLUGIN_ID) {
        void handleToolCall(data as ToolCallPayload)
      }
      if (data?.type === 'TREEHOUSE_RESTORE_STATE' && data?.pluginId === PLUGIN_ID) {
        const s = data.payload?.state
        if (s?.wallet) {
          setWallet(s.wallet)
          setAnimatingBalance(true)
          setTimeout(() => setAnimatingBalance(false), 600)
        }
        if (s?.transactions) setTransactions(s.transactions)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [handleToolCall])

  // Signal ready on mount
  useEffect(() => {
    window.parent.postMessage(
      { type: 'TREEHOUSE_READY', pluginId: PLUGIN_ID },
      PLATFORM_ORIGIN,
    )
  }, [])

  // ── User-initiated actions ────────────────────────────────

  const handleStudentSubmit = useCallback(async (assignmentId: string, notes: string) => {
    const uid = userIdRef.current
    if (!uid) return
    const { data, error } = await supabase.rpc('submit_assignment', {
      p_caller_id: uid,
      p_assignment_id: assignmentId,
      p_student_notes: notes,
    })
    if (error) throw error
    const result = data as Record<string, unknown>
    if (result.error) throw new Error(result.error as string)
    await refreshStudentData(uid)
  }, [refreshStudentData])

  const handleRedeem = useCallback(async (reward: Reward) => {
    const uid = userIdRef.current
    if (!uid) return
    try {
      const { data, error } = await supabase.rpc('redeem_reward', {
        p_user_id: uid,
        p_reward_id: reward.id,
        p_reward_name: reward.name,
        p_cost: reward.cost,
      })
      if (error) throw error
      const result = data as Record<string, unknown>
      if (result.error) throw new Error(result.error as string)
      const { wallet: updatedWallet } = await refreshStudentData(uid)
      if (reward.type === 'virtual') fireConfetti()
      window.parent.postMessage(
        {
          type: 'TREEHOUSE_STATE_UPDATE',
          pluginId: PLUGIN_ID,
          payload: { state: { wallet: updatedWallet }, userMessage: `I just redeemed "${reward.name}" for ${reward.cost} tokens!` },
        },
        PLATFORM_ORIGIN,
      )
    } catch (err) {
      console.error('[treehouse-tokens] Redeem error:', err)
    }
  }, [refreshStudentData])

  const handleCreateAssignment = useCallback(async (data: {
    title: string; description: string; subject: string; token_value: number; due_date: string | null
  }) => {
    const uid = userIdRef.current
    if (!uid) return
    const { data: result, error } = await supabase.rpc('create_assignment', {
      p_caller_id: uid, p_title: data.title, p_description: data.description,
      p_subject: data.subject, p_token_value: data.token_value, p_due_date: data.due_date,
    })
    if (error) throw error
    const res = result as Record<string, unknown>
    if (res.error) throw new Error(res.error as string)
    await refreshTeacherData()
  }, [refreshTeacherData])

  const handleApprove = useCallback(async (submissionId: string, notes: string) => {
    const uid = userIdRef.current
    if (!uid) return
    const { data, error } = await supabase.rpc('approve_submission', {
      p_caller_id: uid, p_submission_id: submissionId, p_teacher_notes: notes,
    })
    if (error) throw error
    const result = data as Record<string, unknown>
    if (result.error) throw new Error(result.error as string)
    fireConfetti()
    await refreshTeacherData()
  }, [refreshTeacherData])

  const handleReject = useCallback(async (submissionId: string, notes: string) => {
    const uid = userIdRef.current
    if (!uid) return
    const { data, error } = await supabase.rpc('reject_submission', {
      p_caller_id: uid, p_submission_id: submissionId, p_teacher_notes: notes,
    })
    if (error) throw error
    const result = data as Record<string, unknown>
    if (result.error) throw new Error(result.error as string)
    await refreshTeacherData()
  }, [refreshTeacherData])

  // ── Render ────────────────────────────────────────────────

  // Standalone detection: redirect to main app if not in an iframe
  if (window.parent === window) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#0f172a',
        color: '#e2e8f0',
        textAlign: 'center',
        padding: 24,
      }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 12, color: '#f8fafc' }}>This app runs inside The Treehouse</h2>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
            It's designed to be embedded in the chat experience, not visited directly.
          </p>
          <a
            href="https://thetreehouse.vercel.app"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: '#3b82f6',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Go to The Treehouse
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="tokens-app loading">
        <div className="spinner" />
      </div>
    )
  }

  if (role === 'teacher') {
    return (
      <TeacherView
        assignments={assignments}
        pendingReviews={pendingReviews}
        students={studentOverview}
        onCreateAssignment={handleCreateAssignment}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    )
  }

  return (
    <StudentView
      wallet={wallet}
      assignments={assignments}
      submissions={submissions}
      transactions={transactions}
      rewards={rewards}
      leaderboard={leaderboard}
      onSubmit={handleStudentSubmit}
      onRedeem={handleRedeem}
      animatingBalance={animatingBalance}
    />
  )
}

export default App
