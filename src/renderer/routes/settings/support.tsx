import { Box, Stack, Text, Title } from '@mantine/core'
import { IconHeadset } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/support')({
  component: SupportPage,
})

function SupportPage() {
  return (
    <Stack gap="xl" p="md" maw={600}>
      <div>
        <Title order={4}>Support</Title>
        <Text size="sm" c="chatbox-secondary" mt="xs">
          Need help with AI model configuration, troubleshooting, or account issues? Reach out to the support team.
        </Text>
      </div>

      <Box
        p="lg"
        style={{
          borderRadius: 12,
          border: '1px solid var(--chatbox-border-primary)',
          background: 'var(--chatbox-background-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <IconHeadset size={24} style={{ color: 'var(--chatbox-tint-brand)' }} />
          <Text fw={600}>The Treehouse Support Team</Text>
        </div>

        <Stack gap="sm">
          <div>
            <Text size="sm" fw={500} c="chatbox-secondary">
              What support can help with:
            </Text>
            <Text size="sm" c="chatbox-secondary" mt={4}>
              - Changing or configuring AI models
            </Text>
            <Text size="sm" c="chatbox-secondary">
              - Adjusting model parameters and tuning
            </Text>
            <Text size="sm" c="chatbox-secondary">
              - Fixing technical issues
            </Text>
            <Text size="sm" c="chatbox-secondary">
              - Account and access management
            </Text>
          </div>

          <div style={{ marginTop: 8 }}>
            <Text size="sm" fw={500} c="chatbox-secondary">
              Contact:
            </Text>
            <Text size="sm" c="chatbox-tint-brand" mt={4}>
              support@thetreehouse.com
            </Text>
          </div>
        </Stack>
      </Box>
    </Stack>
  )
}
