import treehouseDay from '@/static/icons/treehouse-day.png'
import treehouseNight from '@/static/icons/treehouse-night.png'
import { useUIStore } from '@/stores/uiStore'

interface TreehouseIconProps {
  size?: number
  className?: string
}

export default function TreehouseIcon({ size = 32, className }: TreehouseIconProps) {
  const realTheme = useUIStore((s) => s.realTheme)
  const src = realTheme === 'dark' ? treehouseNight : treehouseDay

  return <img src={src} width={size} height={size} className={className} alt="The Treehouse" style={{ borderRadius: size > 48 ? 16 : 8, objectFit: 'cover' }} />
}
