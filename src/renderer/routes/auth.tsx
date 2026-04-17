import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { setAuthToken } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import TreehouseIcon from '@/components/TreehouseIcon'
import { AuthTexture } from '@/components/TreehouseTexture'

export const Route = createFileRoute('/auth')({
  component: AuthPage,
})

function AuthPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [teacherCode, setTeacherCode] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')

      if (!email || !password) {
        setError('Email and password are required.')
        return
      }

      // Teacher code is validated server-side by /api/claim-teacher-role
      // after the user has authenticated. We only check that one was supplied
      // before kicking off the auth flow.
      if (role === 'teacher' && !teacherCode) {
        setError('Teacher code is required.')
        return
      }

      setIsSubmitting(true)
      try {
        // Attempt sign-in first
        const { data: signInData, error: signInError } = await supabase!.auth.signInWithPassword({
          email,
          password,
        })

        let session = signInData?.session

        // If user does not exist, sign them up. We never pass `role` into
        // user_metadata — the role is read from user_profiles, which is the
        // only place a privileged role can legitimately live.
        if (signInError?.message?.toLowerCase().includes('invalid login credentials') ||
            signInError?.message?.toLowerCase().includes('user not found')) {
          const { data: signUpData, error: signUpError } = await supabase!.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: email.split('@')[0] }
            }
          })
          // "User already registered" means the sign-in password was wrong, not that the user is new
          if (signUpError) {
            if (signUpError.message?.toLowerCase().includes('already registered')) {
              throw new Error('Invalid email or password.')
            }
            throw signUpError
          }

          // If email confirmation is required, signUp returns a user but no session
          if (signUpData?.user && !signUpData?.session) {
            const { data: retryData, error: retryError } = await supabase!.auth.signInWithPassword({
              email,
              password,
            })
            if (retryError) throw retryError
            session = retryData?.session
          } else {
            session = signUpData?.session
          }
        }

        if (signInError && !session) throw signInError
        if (!session) throw new Error('No session returned — check Supabase email confirmation settings')

        // Store the Supabase access token — useAuth reads this
        await setAuthToken(session.access_token)

        // Insert the profile row if it doesn't exist yet. New rows are forced
        // to role='student' by the user_profiles_insert RLS policy; column
        // grants prevent us from updating role from the client at all, so we
        // intentionally use ignoreDuplicates to avoid touching existing rows.
        const { error: upsertErr } = await supabase!.from('user_profiles').upsert({
          user_id: session.user.id,
          email,
          display_name: email.split('@')[0],
          role: 'student',
        }, { onConflict: 'user_id', ignoreDuplicates: true })
        if (upsertErr) console.warn('[treehouse-auth] profile upsert failed:', upsertErr)

        // If the user picked "teacher", ask the server to validate the code
        // and elevate their role. The browser never sees the secret.
        if (role === 'teacher') {
          const claimRes = await fetch('/api/claim-teacher-role', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ code: teacherCode }),
          })
          if (!claimRes.ok) {
            const { error: claimErr } = await claimRes.json().catch(() => ({ error: '' }))
            throw new Error(claimErr || 'Failed to verify teacher code.')
          }
        }

        // Allow useAuth to pick up the new token before navigating
        await new Promise((r) => setTimeout(r, 100))
        navigate({ to: '/', replace: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sign-in failed. Please try again.'
        setError(msg)
        console.error('Auth error:', err)
      } finally {
        setIsSubmitting(false)
      }
    },
    [email, password, role, teacherCode, navigate]
  )

  return (
    <div
      className="treehouse-auth-bg"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <AuthTexture />
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 24,
          borderRadius: 12,
          background: 'var(--chatbox-background-secondary)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.2), 0 0 80px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <TreehouseIcon size={100} />
        </div>
        <h1
          style={{
            margin: '0 0 4px',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--chatbox-tint-primary)',
            textAlign: 'center',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          The Treehouse
        </h1>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: 14,
            color: 'var(--chatbox-tint-tertiary)',
            textAlign: 'center',
          }}
        >
          Sign in to continue
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--chatbox-tint-primary)',
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid var(--chatbox-border-primary)',
                borderRadius: 8,
                outline: 'none',
                background: 'var(--chatbox-background-primary)',
                color: 'var(--chatbox-tint-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--chatbox-tint-primary)',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid var(--chatbox-border-primary)',
                borderRadius: 8,
                outline: 'none',
                background: 'var(--chatbox-background-primary)',
                color: 'var(--chatbox-tint-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Role selection — side-by-side buttons */}
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--chatbox-tint-primary)',
              }}
            >
              I am a...
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['student', 'teacher'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: role === r ? '2px solid var(--chatbox-tint-brand)' : '1px solid var(--chatbox-border-primary)',
                    background: role === r ? 'var(--chatbox-tint-brand)' : 'var(--chatbox-background-primary)',
                    color: role === r ? '#fff' : 'var(--chatbox-tint-primary)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Teacher code */}
          {role === 'teacher' && (
            <div style={{ marginBottom: 12 }}>
              <label
                htmlFor="teacherCode"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--chatbox-tint-primary)',
                }}
              >
                Teacher Code
              </label>
              <input
                id="teacherCode"
                type="text"
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
                placeholder="Enter your teacher code"
                autoComplete="off"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 14,
                  border: '1px solid var(--chatbox-border-primary)',
                  borderRadius: 8,
                  outline: 'none',
                  background: 'var(--chatbox-background-primary)',
                  color: 'var(--chatbox-tint-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {error && (
            <p
              style={{
                margin: '0 0 12px',
                fontSize: 13,
                color: 'var(--chatbox-tint-error)',
                textAlign: 'center',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '10px 0',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: 'var(--treehouse-accent, var(--chatbox-tint-brand))',
              border: 'none',
              borderRadius: 22,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
