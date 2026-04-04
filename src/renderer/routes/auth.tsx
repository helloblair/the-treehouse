import { SignJWT } from 'jose'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { setAuthToken } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

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

      // Validate teacher code
      if (role === 'teacher') {
        // @ts-ignore - import.meta.env is a Vite feature
        const expectedCode = (import.meta.env?.VITE_TEACHER_CODE as string) || 'oak2026'
        if (teacherCode !== expectedCode) {
          setError('Invalid teacher code.')
          return
        }
      }

      setIsSubmitting(true)
      try {
        // @ts-ignore - import.meta.env is a Vite feature
        const secret = (import.meta.env?.VITE_JWT_SECRET as string) || 'treehouse-dev-secret-replace-in-production'
        const encodedSecret = new TextEncoder().encode(secret)

        // Generate a deterministic userId from email
        let userId: string
        if (globalThis.crypto?.subtle) {
          const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('treehouse:' + email))
          const hex = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('')
          userId = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`
        } else {
          // Fallback: simple hash for environments without crypto.subtle
          let h = 0
          const src = 'treehouse:' + email
          for (let i = 0; i < src.length; i++) h = ((h << 5) - h + src.charCodeAt(i)) | 0
          const hex = Math.abs(h).toString(16).padStart(8, '0')
          userId = `${hex}0000-0000-4000-a000-000000000000`
        }

        // Upsert user profile in Supabase
        await supabase.from('user_profiles').upsert({
          user_id: userId,
          email,
          display_name: email.split('@')[0],
          role,
        }, { onConflict: 'user_id' })

        const token = await new SignJWT({ email, role })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(userId)
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(encodedSecret)

        await setAuthToken(token)
        navigate({ to: '/', replace: true })
      } catch (err) {
        setError('Sign-in failed. Please try again.')
        console.error('Auth error:', err)
      } finally {
        setIsSubmitting(false)
      }
    },
    [email, password, navigate]
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--chatbox-background-primary, #f8f9fa)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 32,
          borderRadius: 12,
          background: 'var(--chatbox-background-secondary, #fff)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
        }}
      >
        <h1
          style={{
            margin: '0 0 8px',
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--chatbox-tint-primary, #212529)',
            textAlign: 'center',
          }}
        >
          The Treehouse
        </h1>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: 14,
            color: 'var(--chatbox-tint-secondary, #868e96)',
            textAlign: 'center',
          }}
        >
          Sign in to continue
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--chatbox-tint-primary, #212529)',
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
                border: '1px solid var(--chatbox-border-primary, #dee2e6)',
                borderRadius: 8,
                outline: 'none',
                background: 'var(--chatbox-background-primary, #f8f9fa)',
                color: 'var(--chatbox-tint-primary, #212529)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--chatbox-tint-primary, #212529)',
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
                border: '1px solid var(--chatbox-border-primary, #dee2e6)',
                borderRadius: 8,
                outline: 'none',
                background: 'var(--chatbox-background-primary, #f8f9fa)',
                color: 'var(--chatbox-tint-primary, #212529)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Role selection */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--chatbox-tint-primary, #212529)',
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
                    border: role === r ? '2px solid var(--chatbox-tint-brand, #228be6)' : '1px solid var(--chatbox-border-primary, #dee2e6)',
                    background: role === r ? 'var(--chatbox-tint-brand, #228be6)' : 'var(--chatbox-background-primary, #f8f9fa)',
                    color: role === r ? '#fff' : 'var(--chatbox-tint-primary, #212529)',
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
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="teacherCode"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--chatbox-tint-primary, #212529)',
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
                  border: '1px solid var(--chatbox-border-primary, #dee2e6)',
                  borderRadius: 8,
                  outline: 'none',
                  background: 'var(--chatbox-background-primary, #f8f9fa)',
                  color: 'var(--chatbox-tint-primary, #212529)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {error && (
            <p
              style={{
                margin: '0 0 16px',
                fontSize: 13,
                color: 'var(--chatbox-tint-error, #e03131)',
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
              background: 'var(--chatbox-tint-brand, #228be6)',
              border: 'none',
              borderRadius: 8,
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
