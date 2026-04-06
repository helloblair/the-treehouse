import { Stack, Text, SimpleGrid, UnstyledButton } from '@mantine/core'
import { pluginStore, usePluginStore } from '@/stores/pluginStore'

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
          color: 'var(--treehouse-sidebar-label, var(--mantine-color-dimmed))',
          letterSpacing: 1.5,
          fontSize: 11,
          fontFamily: 'Funnel Sans, Inter, sans-serif',
        }}
      >
        PLUG-INS
      </Text>
      <SimpleGrid cols={3} spacing={8} px={4}>
        {manifests.map((plugin) => (
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
              background: plugin.enabled
                ? 'var(--treehouse-sidebar-bg-accent)'
                : 'rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* Icon area */}
            <div
              style={{
                width: '100%',
                height: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                color: plugin.enabled
                  ? 'var(--treehouse-sidebar-text, #FFFDF7)'
                  : 'var(--treehouse-sidebar-text, #FFFDF7)',
              }}
            >
              {degraded[plugin.id] ? '⚠' : '🧩'}
            </div>

            {/* Label area — fixed height, centered, wraps at spaces */}
            <div
              style={{
                width: '100%',
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingBottom: 6,
              }}
            >
              <Text
                style={{
                  color: 'var(--treehouse-sidebar-text, #FFFDF7)',
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
        ))}
      </SimpleGrid>
    </Stack>
  )
}
