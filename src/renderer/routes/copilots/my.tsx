import { Button, Grid, Stack, Text } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { useAuth } from '@/hooks/useAuth'
import { useApprovedCopilots, useMyCopilots } from '@/hooks/useCopilots'
import CopilotItem from './-components/CopilotItem'

export const Route = createFileRoute('/copilots/my')({
  component: MyCopilots,
})

function MyCopilots() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isTeacher = user?.role === 'teacher'
  const { copilots } = useMyCopilots()
  const { approve, revoke, isApproved } = useApprovedCopilots()

  if (!isTeacher) {
    return (
      <Stack px="sm" py="xl" gap="lg" className="max-w-7xl" align="center" justify="center">
        <ScalableIcon icon={IconLock} size={48} className="text-chatbox-tint-tertiary" />
        <Text c="dimmed" size="sm" ta="center">
          {t('Only teachers can manage copilots.')}
        </Text>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: '/copilots' })}>
          {t('Back to Copilots')}
        </Button>
      </Stack>
    )
  }

  return (
    <Stack px="sm" py="xl" gap="lg" className="max-w-7xl">
      {copilots.length === 0 ? (
        // Empty State
        <div className="py-12 text-center">
          <Text c="dimmed" size="sm">
            {t('No copilots yet. Create your first one!')}
          </Text>
        </div>
      ) : (
        // Copilots Grid
        <Grid gutter="xs">
          {copilots.map((copilot) => (
            <Grid.Col span={{ base: 12, md: 6, lg: 4, xl: 3 }} key={copilot.id}>
              <CopilotItem
                copilot={copilot}
                onApprove={approve}
                onRevoke={revoke}
                isApproved={isApproved(copilot.id)}
              />
            </Grid.Col>
          ))}
        </Grid>
      )}
    </Stack>
  )
}
