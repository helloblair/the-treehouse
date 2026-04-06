import { Stack, Text, SimpleGrid, UnstyledButton } from '@mantine/core'
import { pluginStore, usePluginStore } from '@/stores/pluginStore'

import chessImg from '@/static/plugins/chess.png'
import pixelartImg from '@/static/plugins/pixelart.png'
import petImg from '@/static/plugins/pet.png'
import tokensImg from '@/static/plugins/tokens.png'
import anatomyImg from '@/static/plugins/anatomy.png'
import pioneerImg from '@/static/plugins/pioneer.png'

const PLUGIN_ARTWORK: Record<string, string> = {
  'treehouse-chess': chessImg,
  'treehouse-pixelart': pixelartImg,
  'treehouse-pet': petImg,
  'treehouse-tokens': tokensImg,
  'treehouse-body': anatomyImg,
  'treehouse-pioneer': pioneerImg,
}

export default function PluginSidebar() {
  const manifests = usePluginStore((s) => s.manifests)
  const degraded = usePluginStore((s) => s.degraded)

  if (manifests.length === 0) return null

  return (
    <Stack gap={0} px="xs" pt="xs">
      <Text
        size="xs"
        fw={600}
        px="xs"
        pb={4}
        style={{
          color: 'var(--treehouse-sidebar-text-muted)',
          letterSpacing: 1.5,
          fontSize: 11,
          fontFamily: 'Funnel Sans, Inter, sans-serif',
        }}
      >
        PLUG-INS
      </Text>
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: 12,
          padding: '8px 12px',
        }}
      >
        <SimpleGrid cols={3} spacing={8}>
          {manifests.map((plugin) => {
            const artwork = PLUGIN_ARTWORK[plugin.id]
            return (
              <UnstyledButton
                key={plugin.id}
                onClick={() => {
                  pluginStore.getState().registerPlugin({ ...plugin, enabled: !plugin.enabled })
                  if (plugin.enabled && pluginStore.getState().activePluginId === plugin.id) {
                    pluginStore.getState().dismissPlugin()
                  }
                }}
                style={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  opacity: degraded[plugin.id] ? 0.5 : 1,
                  background: 'var(--treehouse-sidebar-bg-accent)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {/* Artwork area — actual plugin illustration from Pencil design */}
                <div
                  style={{
                    width: '100%',
                    height: 56,
                    backgroundImage: artwork ? `url(${artwork})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: artwork ? undefined : 'var(--treehouse-sidebar-bg-accent)',
                  }}
                />

                {/* Label area — fixed height, centered, wraps at spaces */}
                <div
                  style={{
                    width: '100%',
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingBottom: 6,
                    paddingLeft: 2,
                    paddingRight: 2,
                  }}
                >
                  <Text
                    style={{
                      color: 'var(--treehouse-sidebar-text)',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 10,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      textAlign: 'center',
                      wordBreak: 'normal',
                      overflowWrap: 'break-word',
                    }}
                  >
                    {plugin.name}
                  </Text>
                </div>
              </UnstyledButton>
            )
          })}
        </SimpleGrid>
      </div>
    </Stack>
  )
}
