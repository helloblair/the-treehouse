import { Accordion, Box, Stack, Text, Title } from '@mantine/core'
import { IconHeadset, IconMail, IconClock, IconShieldCheck } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/support')({
  component: RouteComponent,
})

export function RouteComponent() {
  return (
    <Stack gap="xl" p="md" maw={640}>
      {/* Header */}
      <div>
        <Title order={4}>Support</Title>
        <Text size="sm" c="chatbox-secondary" mt="xs">
          We're here to help. Whether you have questions about your account, need technical assistance, or want to
          report an issue, our team is ready to support you.
        </Text>
      </div>

      {/* Contact Card */}
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
          <Text fw={600}>Contact Us</Text>
        </div>

        <Stack gap="md">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconMail size={18} style={{ color: 'var(--chatbox-tint-tertiary)' }} />
            <div>
              <Text size="sm" fw={500}>Email</Text>
              <Text size="sm" c="chatbox-tint-brand">support@thetreehouse.edu</Text>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconClock size={18} style={{ color: 'var(--chatbox-tint-tertiary)' }} />
            <div>
              <Text size="sm" fw={500}>Response Time</Text>
              <Text size="sm" c="chatbox-secondary">We typically respond within 24 hours during school days.</Text>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconShieldCheck size={18} style={{ color: 'var(--chatbox-tint-tertiary)' }} />
            <div>
              <Text size="sm" fw={500}>Privacy</Text>
              <Text size="sm" c="chatbox-secondary">
                All student data is handled in accordance with FERPA and COPPA guidelines.
              </Text>
            </div>
          </div>
        </Stack>
      </Box>

      {/* FAQ */}
      <div>
        <Title order={5} mb="sm">Frequently Asked Questions</Title>
        <Accordion variant="separated" radius="md">
          <Accordion.Item value="reset-password">
            <Accordion.Control>
              <Text size="sm" fw={500}>How do I reset my password?</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="chatbox-secondary">
                Contact your teacher or school administrator to reset your password. If you are a teacher, reach out to
                support and we'll help you get back into your account.
              </Text>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="ai-not-responding">
            <Accordion.Control>
              <Text size="sm" fw={500}>The AI isn't responding. What should I do?</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="chatbox-secondary">
                Try refreshing the page first. If the problem persists, check your internet connection. If everything
                else looks good, the AI service may be temporarily unavailable — please try again in a few minutes or
                contact support.
              </Text>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="plugin-not-loading">
            <Accordion.Control>
              <Text size="sm" fw={500}>A plug-in isn't loading properly.</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="chatbox-secondary">
                Make sure the plug-in is enabled in the sidebar. If it still doesn't load, try restarting the app. Some
                plug-ins require an internet connection to work. If the issue continues, let your teacher know or
                contact support with the name of the plug-in.
              </Text>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="teacher-code">
            <Accordion.Control>
              <Text size="sm" fw={500}>Where do I find my teacher code?</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="chatbox-secondary">
                Teacher codes are provided by your school administrator. If you haven't received one, please reach out
                to your school's IT department or contact support.
              </Text>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="report-content">
            <Accordion.Control>
              <Text size="sm" fw={500}>How do I report inappropriate content?</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="chatbox-secondary">
                If you encounter any content that seems inappropriate or harmful, please tell your teacher immediately.
                Teachers can report it to support and we will investigate promptly. Student safety is our top priority.
              </Text>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </div>

      {/* Footer note */}
      <Text size="xs" c="chatbox-tertiary" ta="center" pb="md">
        The Treehouse is built for K-12 classrooms. All interactions are monitored for safety.
      </Text>
    </Stack>
  )
}
