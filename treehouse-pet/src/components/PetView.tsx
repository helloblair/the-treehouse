import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calculateDecay, getMood } from '../lib/decay'
import type { Pet, Mood } from '../types'
import PetAnimation from './PetAnimation'

interface PetViewProps {
  pet: Pet
  onPetUpdate: (pet: Pet) => void
}

const STAT_COLORS = {
  hunger: '#FF8C42',
  happiness: '#FFD93D',
  health: '#6BCB77',
  cleanliness: '#5BC0DE',
}

const STAGE_LABELS: Record<Pet['growth_stage'], string> = {
  puppy: 'Baby',
  junior: 'Junior',
  adult: 'Adult',
}

const GROWTH_THRESHOLDS = { junior: 100, adult: 300, max: 500 }

/* ─── Diminishing returns config ─── */

const FEED_REWARDS = [25, 15, 5]       // 3 feeds/day
const PLAY_REWARDS = [30, 15, 5]       // 3 plays/day
const PET_REWARDS = [10, 6, 3, 1]      // 4 pets/day
const BATH_REWARDS = [15, 8]           // 2 baths/day (happiness + resets stinky timer)

interface DailyUsage {
  feed: number
  play: number
  pet: number
  bath: number
  date: string // YYYY-MM-DD
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadDailyUsage(): DailyUsage {
  try {
    const raw = localStorage.getItem('treehouse_pet_daily_usage')
    if (raw) {
      const parsed = JSON.parse(raw) as DailyUsage
      if (parsed.date === getTodayKey()) return parsed
    }
  } catch { /* ignore */ }
  return { feed: 0, play: 0, pet: 0, bath: 0, date: getTodayKey() }
}

function saveDailyUsage(usage: DailyUsage) {
  localStorage.setItem('treehouse_pet_daily_usage', JSON.stringify(usage))
}

function getReward(rewards: number[], usedCount: number): number | null {
  if (usedCount >= rewards.length) return null
  return rewards[usedCount]
}

function getRemainingLabel(rewards: number[], usedCount: number): string {
  const remaining = rewards.length - usedCount
  if (remaining <= 0) return 'Done for today'
  return `${remaining} left today`
}

/* ─── Components ─── */

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{value}/100</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: '#eee',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            borderRadius: 4,
            background: color,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}

function XpBar({ xp, growthStage }: { xp: number; growthStage: Pet['growth_stage'] }) {
  const nextStage = growthStage === 'puppy' ? 'junior' : growthStage === 'junior' ? 'adult' : null
  const currentThreshold = growthStage === 'puppy' ? 0 : growthStage === 'junior' ? GROWTH_THRESHOLDS.junior : GROWTH_THRESHOLDS.adult
  const nextThreshold = nextStage
    ? (nextStage === 'adult' ? GROWTH_THRESHOLDS.adult : GROWTH_THRESHOLDS.junior)
    : GROWTH_THRESHOLDS.max
  const progress = Math.min(100, ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100)

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>
          XP {nextStage ? `→ ${STAGE_LABELS[nextStage]}` : '(Max)'}
        </span>
        <span style={{ fontSize: 11, color: '#888' }}>{xp}/{nextThreshold}</span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 5,
          background: '#eee',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 5,
            background: 'linear-gradient(90deg, #7C4DFF, #B388FF)',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}

export default function PetView({ pet, onPetUpdate }: PetViewProps) {
  const [mood, setMood] = useState<Mood>('happy')
  const [moodOverride, setMoodOverride] = useState<Mood | null>(null)
  const [displayPet, setDisplayPet] = useState(pet)
  const [cooldowns, setCooldowns] = useState({ feed: false, play: false, pet: false, bath: false })
  const [dailyUsage, setDailyUsage] = useState<DailyUsage>(loadDailyUsage)

  const recalcDisplay = useCallback((p: Pet) => {
    const decayed = calculateDecay(p)
    const merged = { ...p, ...decayed } as Pet & { hunger: number; happiness: number; health: number }
    setDisplayPet(merged)
    setMood(getMood(merged))
  }, [])

  useEffect(() => {
    async function syncDecay() {
      const decayed = calculateDecay(pet)
      const merged = { ...pet, ...decayed } as Pet & { hunger: number; happiness: number; health: number }
      setDisplayPet(merged)
      setMood(getMood(merged))

      const { data } = await supabase
        .from('pets')
        .update({
          hunger: merged.hunger,
          happiness: merged.happiness,
          health: merged.health,
          last_active_at: new Date().toISOString(),
        })
        .eq('id', pet.id)
        .select()
        .single()

      if (data) {
        onPetUpdate(data as Pet)
        recalcDisplay(data as Pet)
      }
    }

    syncDecay()
  }, [pet.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset daily usage at midnight
  useEffect(() => {
    const now = new Date()
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
    const timer = setTimeout(() => {
      const fresh = { feed: 0, play: 0, pet: 0, bath: 0, date: getTodayKey() }
      setDailyUsage(fresh)
      saveDailyUsage(fresh)
    }, msUntilMidnight)
    return () => clearTimeout(timer)
  }, [dailyUsage.date])

  function flashMood(m: Mood, ms: number) {
    setMoodOverride(m)
    setTimeout(() => setMoodOverride(null), ms)
  }

  function startCooldown(key: 'feed' | 'play' | 'pet', ms: number) {
    setCooldowns((prev) => ({ ...prev, [key]: true }))
    setTimeout(() => setCooldowns((prev) => ({ ...prev, [key]: false })), ms)
  }

  function bumpUsage(key: 'feed' | 'play' | 'pet') {
    const updated = { ...dailyUsage, [key]: dailyUsage[key] + 1 }
    setDailyUsage(updated)
    saveDailyUsage(updated)
  }

  async function handleFeed() {
    const reward = getReward(FEED_REWARDS, dailyUsage.feed)
    if (reward === null || cooldowns.feed) return
    startCooldown('feed', 5000)
    bumpUsage('feed')

    const newHunger = Math.min(100, displayPet.hunger + reward)
    const newHealth = Math.min(100, displayPet.health + Math.max(1, Math.floor(reward / 5)))

    const { data } = await supabase
      .from('pets')
      .update({
        hunger: newHunger,
        health: newHealth,
        last_fed_at: new Date().toISOString(),
      })
      .eq('id', pet.id)
      .select()
      .single()

    if (data) {
      onPetUpdate(data as Pet)
      recalcDisplay(data as Pet)
      flashMood('happy', 2000)
    }
  }

  async function handlePlay() {
    const reward = getReward(PLAY_REWARDS, dailyUsage.play)
    if (reward === null || cooldowns.play) return
    startCooldown('play', 8000)
    bumpUsage('play')

    const newHappiness = Math.min(100, displayPet.happiness + reward)

    const { data } = await supabase
      .from('pets')
      .update({
        happiness: newHappiness,
        last_played_at: new Date().toISOString(),
      })
      .eq('id', pet.id)
      .select()
      .single()

    if (data) {
      onPetUpdate(data as Pet)
      recalcDisplay(data as Pet)
      flashMood('ecstatic', 3000)
    }
  }

  async function handlePet() {
    const reward = getReward(PET_REWARDS, dailyUsage.pet)
    if (reward === null || cooldowns.pet) return
    startCooldown('pet', 3000)
    bumpUsage('pet')

    const newHappiness = Math.min(100, displayPet.happiness + reward)
    const newHealth = Math.min(100, displayPet.health + Math.max(1, Math.floor(reward / 3)))

    const { data } = await supabase
      .from('pets')
      .update({
        happiness: newHappiness,
        health: newHealth,
      })
      .eq('id', pet.id)
      .select()
      .single()

    if (data) {
      onPetUpdate(data as Pet)
      recalcDisplay(data as Pet)
      flashMood('happy', 1500)
    }
  }

  async function handleBath() {
    const reward = getReward(BATH_REWARDS, dailyUsage.bath)
    if (reward === null || cooldowns.bath) return
    startCooldown('bath', 6000)
    bumpUsage('bath')

    const newHappiness = Math.min(100, displayPet.happiness + reward)
    const newHealth = Math.min(100, displayPet.health + 5)

    const { data } = await supabase
      .from('pets')
      .update({
        happiness: newHappiness,
        health: newHealth,
        last_bathed_at: new Date().toISOString(),
      })
      .eq('id', pet.id)
      .select()
      .single()

    if (data) {
      onPetUpdate(data as Pet)
      recalcDisplay(data as Pet)
      flashMood('ecstatic', 2000)
    }
  }

  const feedReward = getReward(FEED_REWARDS, dailyUsage.feed)
  const playReward = getReward(PLAY_REWARDS, dailyUsage.play)
  const petReward = getReward(PET_REWARDS, dailyUsage.pet)
  const bathReward = getReward(BATH_REWARDS, dailyUsage.bath)
  const allUsedUp = feedReward === null && playReward === null && petReward === null && bathReward === null
  const activeMood = moodOverride ?? mood

  // Pet is off playing — all care used up for the day
  if (allUsedUp && !moodOverride) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ width: 195, height: 195, margin: '0 auto 14px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, transform: 'scale(0.65)', transformOrigin: 'top left' }}>
            <PetAnimation petType={displayPet.pet_type} mood="ecstatic" />
          </div>
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>
          {displayPet.name} is out playing!
        </h2>
        <p style={{ margin: '0 0 6px', fontSize: 13, color: '#666', lineHeight: 1.5 }}>
          You've taken great care of {displayPet.name} today. They're off having fun now!
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888' }}>
          Focus on your work — {displayPet.name} will be back tomorrow for more care.
        </p>

        <div style={{
          padding: '10px 16px',
          borderRadius: 12,
          background: '#f0f7ff',
          border: '1px solid #d0e3ff',
          fontSize: 12,
          color: '#4a80cc',
          lineHeight: 1.5,
        }}>
          Completing assignments still earns XP for {displayPet.name}!
        </div>

        <div style={{ maxWidth: 280, margin: '20px auto 0' }}>
          <StatBar label="Hunger" value={displayPet.hunger} color={STAT_COLORS.hunger} />
          <StatBar label="Happiness" value={displayPet.happiness} color={STAT_COLORS.happiness} />
          <StatBar label="Health" value={displayPet.health} color={STAT_COLORS.health} />
          <StatBar label="Cleanliness" value={Math.max(0, Math.round(100 - ((Date.now() - new Date(displayPet.last_bathed_at).getTime()) / 3600000) * (100 / 8)))} color={STAT_COLORS.cleanliness} />
          <XpBar xp={displayPet.xp} growthStage={displayPet.growth_stage} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 14, textAlign: 'center' }}>
      <div style={{ width: 195, height: 195, margin: '0 auto 10px', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, transform: 'scale(0.65)', transformOrigin: 'top left' }}>
          <PetAnimation petType={displayPet.pet_type} mood={activeMood} />
        </div>
      </div>

      <h2 style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 700 }}>
        {displayPet.name}
      </h2>

      <span
        style={{
          display: 'inline-block',
          padding: '2px 10px',
          fontSize: 10,
          fontWeight: 700,
          borderRadius: 12,
          background: '#4a9eff22',
          color: '#4a9eff',
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {STAGE_LABELS[displayPet.growth_stage]}
      </span>

      <div style={{ maxWidth: 200, margin: '0 auto 12px' }}>
        <XpBar xp={displayPet.xp} growthStage={displayPet.growth_stage} />
      </div>

      {/* Care buttons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
        <CareButton
          label="Feed"
          emoji="🍖"
          color="#FF8C42"
          onClick={handleFeed}
          disabled={cooldowns.feed || feedReward === null}
          hint={feedReward !== null ? `+${feedReward} hunger` : 'Done for today'}
          remaining={getRemainingLabel(FEED_REWARDS, dailyUsage.feed)}
        />
        <CareButton
          label="Play"
          emoji="🎾"
          color="#4D96FF"
          onClick={handlePlay}
          disabled={cooldowns.play || playReward === null}
          hint={playReward !== null ? `+${playReward} happy` : 'Done for today'}
          remaining={getRemainingLabel(PLAY_REWARDS, dailyUsage.play)}
        />
        <CareButton
          label="Pet"
          emoji="✋"
          color="#E88BD5"
          onClick={handlePet}
          disabled={cooldowns.pet || petReward === null}
          hint={petReward !== null ? `+${petReward} happy` : 'Done for today'}
          remaining={getRemainingLabel(PET_REWARDS, dailyUsage.pet)}
        />
        <CareButton
          label="Bath"
          emoji="🛁"
          color="#5BC0DE"
          onClick={handleBath}
          disabled={cooldowns.bath || bathReward === null}
          hint={bathReward !== null ? `+${bathReward} happy` : 'Done for today'}
          remaining={getRemainingLabel(BATH_REWARDS, dailyUsage.bath)}
        />
      </div>

      <div style={{ maxWidth: 280, margin: '0 auto' }}>
        <StatBar label="Hunger" value={displayPet.hunger} color={STAT_COLORS.hunger} />
        <StatBar label="Happiness" value={displayPet.happiness} color={STAT_COLORS.happiness} />
        <StatBar label="Health" value={displayPet.health} color={STAT_COLORS.health} />
      </div>
    </div>
  )
}

function CareButton({
  label,
  emoji,
  color,
  onClick,
  disabled,
  hint,
  remaining,
}: {
  label: string
  emoji: string
  color: string
  onClick: () => void
  disabled: boolean
  hint: string
  remaining: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '6px 12px',
        borderRadius: 12,
        border: `2px solid ${disabled ? '#ddd' : color}`,
        background: disabled ? '#f5f5f5' : `${color}11`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
        minWidth: 70,
      }}
    >
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: disabled ? '#aaa' : color }}>{label}</span>
      <span style={{ fontSize: 8, color: '#999', marginTop: 1 }}>{remaining}</span>
    </button>
  )
}
