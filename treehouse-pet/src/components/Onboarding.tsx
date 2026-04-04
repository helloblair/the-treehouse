import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Pet } from '../types'
import PetAnimation from './PetAnimation'

type PetType = Pet['pet_type']

const PET_OPTIONS: { type: PetType; label: string }[] = [
  { type: 'dachshund', label: 'Dachshund' },
  { type: 'calico', label: 'Calico Cat' },
  { type: 'bunny', label: 'Bunny' },
  { type: 'frog', label: 'Frog' },
  { type: 'hamster', label: 'Hamster' },
  { type: 'lizard', label: 'Lizard' },
]

const NAME_PLACEHOLDERS: Record<PetType, string> = {
  dachshund: 'e.g. Pretzel, Wiggles, Noodle...',
  calico: 'e.g. Patches, Mochi, Whiskers...',
  bunny: 'e.g. Bun-Bun, Clover, Thumper...',
  frog: 'e.g. Ribbit, Lily, Hopscotch...',
  hamster: 'e.g. Nugget, Peanut, Hammy...',
  lizard: 'e.g. Scales, Draco, Ziggy...',
}

interface OnboardingProps {
  userId: string
  onComplete: (pet: Pet) => void
}

export default function Onboarding({ userId, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1)
  const [selectedPet, setSelectedPet] = useState<PetType | null>(null)
  const [previewPet, setPreviewPet] = useState<PetType | null>(null)
  const [petName, setPetName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function createPet() {
    if (!selectedPet || !petName.trim()) return
    setSaving(true)
    setError('')

    const { data, error: dbError } = await supabase
      .from('pets')
      .insert({
        user_id: userId,
        name: petName.trim(),
        pet_type: selectedPet,
      })
      .select()
      .single()

    if (dbError || !data) {
      setError(dbError?.message ?? 'Failed to create pet')
      setSaving(false)
      return
    }

    onComplete(data as Pet)
  }

  return (
    <div style={{ padding: 12, textAlign: 'center', position: 'relative' }}>
      {step === 1 && (
        <>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>
            Choose your companion!
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#666' }}>
            Tap a pet to preview, then pick your favorite.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
          }}>
            {PET_OPTIONS.map(({ type, label }) => (
              <button
                key={type}
                onClick={() => setPreviewPet(type)}
                style={{
                  padding: 6,
                  borderRadius: 10,
                  border: selectedPet === type ? '3px solid #4a9eff' : '2px solid #e0e0e0',
                  background: selectedPet === type ? '#4a9eff11' : '#fafafa',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  width: 72,
                  height: 72,
                  margin: '0 auto',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: 'scale(0.24)',
                    transformOrigin: 'top left',
                  }}>
                    <PetAnimation petType={type} mood="happy" />
                  </div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{label}</div>
              </button>
            ))}
          </div>
          <button
            disabled={!selectedPet}
            onClick={() => setStep(2)}
            style={{
              marginTop: 14,
              padding: '8px 28px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              background: selectedPet ? '#4a9eff' : '#ccc',
              color: '#fff',
              cursor: selectedPet ? 'pointer' : 'not-allowed',
            }}
          >
            Next
          </button>

          {/* Preview modal */}
          {previewPet && (
            <div
              onClick={() => setPreviewPet(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff',
                  borderRadius: 20,
                  padding: 20,
                  textAlign: 'center',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                  maxWidth: 340,
                }}
              >
                <div style={{ width: 240, height: 240, margin: '0 auto 12px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                    <PetAnimation petType={previewPet} mood="happy" />
                  </div>
                </div>
                <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>
                  {PET_OPTIONS.find((p) => p.type === previewPet)?.label}
                </h3>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    onClick={() => setPreviewPet(null)}
                    style={{
                      padding: '8px 20px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: '2px solid #e0e0e0',
                      background: '#fff',
                      color: '#666',
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPet(previewPet)
                      setPreviewPet(null)
                    }}
                    style={{
                      padding: '8px 20px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: 'none',
                      background: '#4a9eff',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Choose this pet!
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {step === 2 && selectedPet && (
        <>
          <div style={{ width: 165, height: 165, margin: '0 auto 12px', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, transform: 'scale(0.55)', transformOrigin: 'top left' }}>
              <PetAnimation petType={selectedPet} mood="happy" />
            </div>
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>
            Name your {PET_OPTIONS.find((p) => p.type === selectedPet)?.label}!
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#666' }}>
            Give your new companion a name (max 20 characters).
          </p>
          <input
            type="text"
            value={petName}
            onChange={(e) => setPetName(e.target.value.slice(0, 20))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && petName.trim()) setStep(3)
            }}
            placeholder={NAME_PLACEHOLDERS[selectedPet]}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 16,
              borderRadius: 8,
              border: '2px solid #e0e0e0',
              outline: 'none',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ marginTop: 6, fontSize: 12, color: '#999' }}>
            {petName.length}/20
          </div>
          <button
            disabled={!petName.trim()}
            onClick={() => setStep(3)}
            style={{
              marginTop: 12,
              padding: '8px 28px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              background: petName.trim() ? '#4a9eff' : '#ccc',
              color: '#fff',
              cursor: petName.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Next
          </button>
        </>
      )}

      {step === 3 && selectedPet && (
        <>
          <div style={{ width: 180, height: 180, margin: '0 auto 12px', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, transform: 'scale(0.6)', transformOrigin: 'top left' }}>
              <PetAnimation petType={selectedPet} mood="ecstatic" />
            </div>
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700 }}>
            Welcome, {petName}!
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666' }}>
            Your new companion is ready to join you on your learning journey.
          </p>
          {error && (
            <p style={{ color: '#e03131', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}
          <button
            disabled={saving}
            onClick={createPet}
            style={{
              padding: '10px 36px',
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 10,
              border: 'none',
              background: '#4a9eff',
              color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Creating...' : "Let's go!"}
          </button>
        </>
      )}
    </div>
  )
}
