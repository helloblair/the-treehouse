import { createFileRoute } from '@tanstack/react-router'
import { Stack, Text } from '@mantine/core'
import TreehouseIcon from '@/components/TreehouseIcon'
import Page from '@/components/layout/Page'

export const Route = createFileRoute('/guide/')({
  component: GuidePage,
})

function GuidePage() {
  return (
    <Page title="">
      <Stack align="center" justify="center" gap="md" flex={1} p="xl">
        <TreehouseIcon size={160} />
        <Text size="xl" fw={700} ta="center" style={{ fontFamily: 'Nunito, sans-serif' }}>
          Welcome to The Treehouse!
        </Text>
        <Text size="md" c="chatbox-tertiary" ta="center" maw={400}>
          You can ask me anything! What do you want to learn today?
        </Text>
      </Stack>
    </Page>
  )
}
