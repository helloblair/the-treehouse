export type Transaction = {
  id: string
  type: 'earn' | 'redeem'
  amount: number
  reason: string
  subject: string | null
  reward_id: string | null
  created_at: string
}

export type Wallet = {
  balance: number
  lifetime_earned: number
  redeemed_rewards: string[]
}

export type Reward = {
  id: string
  name: string
  type: 'real' | 'virtual'
  cost: number
  description: string
  redemption_code?: string
  emoji: string
}

export type Assignment = {
  id: string
  teacher_id: string
  title: string
  description: string
  subject: string
  token_value: number
  due_date: string | null
  status: 'active' | 'archived'
  created_at: string
}

export type Submission = {
  id: string
  assignment_id: string
  student_id: string
  status: 'pending' | 'approved' | 'rejected'
  student_notes: string
  teacher_notes: string
  submitted_at: string
  reviewed_at: string | null
}

export type PendingReview = {
  submission_id: string
  assignment_id: string
  assignment_title: string
  subject: string
  token_value: number
  student_name: string
  student_notes: string
  submitted_at: string
}

export type StudentOverview = {
  display_name: string
  balance: number
  lifetime_earned: number
}
