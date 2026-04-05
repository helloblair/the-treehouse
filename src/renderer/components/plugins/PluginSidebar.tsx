import { NavLink, Stack, Text } from '@mantine/core'
import { pluginStore, usePluginStore } from '@/stores/pluginStore'

export default function PluginSidebar() {
  const manifests = usePluginStore((s) => s.manifests)
  const degraded = usePluginStore((s) => s.degraded)

  if (manifests.length === 0) return null

  return (
    <Stack gap={0} px="xs" pt="xs">
      <Text size="xs" fw={600} c="dimmed" px="xs" pb={4}>
        Plugins
      </Text>
      {manifests.map((plugin) => (
        <NavLink
          key={plugin.id}
          label={plugin.name}
          description={degraded[plugin.id] ? 'unavailable' : undefined}
          active={plugin.enabled}
          onClick={() => {
            // Toggle enabled state
            pluginStore.getState().registerPlugin({ ...plugin, enabled: !plugin.enabled })
            // If disabling, also dismiss if it was active
            if (plugin.enabled && pluginStore.getState().activePluginId === plugin.id) {
              pluginStore.getState().dismissPlugin()
            }
          }}
          leftSection={
            degraded[plugin.id] ? (
              <span style={{ fontSize: 14, lineHeight: 1 }} title="Plugin unavailable — too many failures">&#9888;</span>
            ) : (
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: plugin.enabled
                    ? 'var(--mantine-color-blue-filled)'
                    : 'var(--mantine-color-gray-5)',
                }}
              />
            )
          }
          styles={{
            root: { borderRadius: 6, opacity: degraded[plugin.id] ? 0.5 : 1 },
          }}
        />
      ))}
    </Stack>
  )
}
