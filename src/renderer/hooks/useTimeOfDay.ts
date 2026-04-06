import { useEffect, useState } from 'react'
import { settingsStore } from '@/stores/settingsStore'
import { Theme } from '@shared/types'
import { switchTheme } from './useAppTheme'

type TimeOfDay = 'day' | 'night'

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours()
  return hour >= 7 && hour < 19 ? 'day' : 'night'
}

/**
 * Automatically switches between light (day) and dark (night) theme
 * based on the current time of day (7am–7pm = day, 7pm–7am = night).
 * Only activates when the user's theme preference is set to "System".
 */
export function useTimeOfDay(): TimeOfDay {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(getTimeOfDay)

  useEffect(() => {
    const check = () => {
      const newTime = getTimeOfDay()
      setTimeOfDay((prev) => {
        if (prev !== newTime) {
          const theme = settingsStore.getState().theme
          if (theme === Theme.System) {
            switchTheme(newTime === 'night' ? Theme.Dark : Theme.Light)
          }
          return newTime
        }
        return prev
      })
    }

    // Check every minute
    const interval = setInterval(check, 60_000)
    // Run once on mount
    check()

    return () => clearInterval(interval)
  }, [])

  return timeOfDay
}

export { getTimeOfDay }
