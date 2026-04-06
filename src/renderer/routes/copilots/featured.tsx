import { Button, Flex, Stack, Text } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { useAuth } from '@/hooks/useAuth'
import { useApprovedCopilots, useRemoteCopilotsByCursor, useRemoteCopilotTags } from '@/hooks/useCopilots'
import CopilotItem from './-components/CopilotItem'

export const Route = createFileRoute('/copilots/featured')({
  component: FeaturedCopilots,
})

const PAGE_SIZE = 18

function FeaturedCopilots() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isTeacher = user?.role === 'teacher'

  const { tags } = useRemoteCopilotTags()
  const [selectedTag, setSelectedTag] = useState<string | undefined>()
  const { copilots, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useRemoteCopilotsByCursor({
    limit: PAGE_SIZE,
    tag: selectedTag,
  })
  const { approve, revoke, isApproved } = useApprovedCopilots()

  const handleTagChange = useCallback((tag: string | undefined) => {
    setSelectedTag((prev) => (prev === tag ? undefined : tag))
  }, [])

  if (!isTeacher) {
    return (
      <Stack px="sm" py="xl" gap="lg" className="max-w-7xl" align="center" justify="center">
        <ScalableIcon icon={IconLock} size={48} className="text-chatbox-tint-tertiary" />
        <Text c="dimmed" size="sm" ta="center">
          {t('Only teachers can browse featured copilots.')}
        </Text>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: '/copilots' })}>
          {t('Back to Copilots')}
        </Button>
      </Stack>
    )
  }

  return (
    <Stack px="sm" py="xl" gap="lg" className="max-w-7xl">
      <Flex align="flex-start" gap="md" className="flex gap-2 flex-wrap">
        <Flex className="flex-1" gap="xxs" wrap="wrap">
          <TagChip selected={selectedTag === undefined} onClick={() => handleTagChange(undefined)}>
            {t('All')}
          </TagChip>
          {tags.map((tag) => (
            <TagChip key={tag} selected={selectedTag === tag} onClick={() => handleTagChange(tag)}>
              {t(tag)}
            </TagChip>
          ))}
        </Flex>
      </Flex>

      {isLoading && (
        <div className="py-12 text-center">
          <Text c="dimmed" size="sm">
            {t('Loading...')}
          </Text>
        </div>
      )}

      {!isLoading && copilots.length === 0 && (
        <div className="py-12 text-center">
          <Text c="dimmed" size="sm">
            {t('No featured copilots available.')}
          </Text>
        </div>
      )}

      {copilots.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {copilots.map((copilot) => (
            <CopilotItem
              key={copilot.id}
              type="remote"
              copilot={copilot}
              onApprove={approve}
              onRevoke={revoke}
              isApproved={isApproved(copilot.id)}
            />
          ))}
        </div>
      )}

      {hasNextPage && (
        <Flex justify="center" className="pt-sm">
          <Button
            variant="outline"
            color="chatbox-brand"
            size="sm"
            onClick={() => fetchNextPage()}
            loading={isFetchingNextPage}
          >
            {t('Load More')}
          </Button>
        </Flex>
      )}
    </Stack>
  )
}

function TagChip({
  selected,
  onClick,
  children,
}: PropsWithChildren & {
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-sm py-xxs rounded-full text-xs font-normal transition-colors cursor-pointer select-none
        ${
          selected
            ? 'border border-chatbox-tint-brand text-chatbox-tint-brand bg-transparent'
            : 'border border-transparent bg-chatbox-background-gray-secondary text-chatbox-tint-secondary'
        }
      `}
    >
      {children}
    </button>
  )
}
