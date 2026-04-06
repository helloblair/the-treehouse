import { useUIStore } from '@/stores/uiStore'

import daySidebarTex from '@/static/textures/day-sidebar-texture.png'
import dayLeavesBottom from '@/static/textures/day-leaves-bottom.png'
import dayLeavesTop from '@/static/textures/day-leaves-top.png'
import nightSidebarTex from '@/static/textures/night-sidebar-texture.png'
import nightLeavesBottom from '@/static/textures/night-leaves-bottom.png'
import dayAuthTex from '@/static/textures/day-auth-texture.png'
import nightAuthTex from '@/static/textures/night-auth-texture.png'

export function SidebarTexture() {
  const isDark = useUIStore((s) => s.realTheme) === 'dark'

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {/* Full texture overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${isDark ? nightSidebarTex : daySidebarTex})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: isDark ? 0.15 : 0.1,
        }}
      />
      {/* Top leaves (day only) */}
      {!isDark && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '15%',
            backgroundImage: `url(${dayLeavesTop})`,
            backgroundSize: 'cover',
            backgroundPosition: 'bottom',
            opacity: 0.3,
          }}
        />
      )}
      {/* Bottom leaves/vines */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '25%',
          backgroundImage: `url(${isDark ? nightLeavesBottom : dayLeavesBottom})`,
          backgroundSize: 'cover',
          backgroundPosition: 'top',
          opacity: isDark ? 0.35 : 0.4,
        }}
      />
    </div>
  )
}

export function AuthTexture() {
  const isDark = useUIStore((s) => s.realTheme) === 'dark'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        backgroundImage: `url(${isDark ? nightAuthTex : dayAuthTex})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: isDark ? 0.15 : 0.1,
      }}
    />
  )
}
