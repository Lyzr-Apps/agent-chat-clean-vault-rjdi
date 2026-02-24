'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { callAIAgent, extractText } from '@/lib/aiAgent'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { FiHeart, FiSmile, FiSend, FiMenu, FiX, FiTrash2, FiPlus, FiMessageCircle, FiCpu, FiRefreshCw } from 'react-icons/fi'

// ---- Constants ----
const AGENT_ID = '699d7148bcfb5ae590f1ee95'
const STORAGE_KEY = 'chatterpal_conversations'

// ---- Types ----
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  error?: boolean
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

// ---- Sample Data ----
const SAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: 'sample-1',
    title: 'Tell me a joke',
    messages: [
      { id: 's1m1', role: 'user', content: 'Tell me a joke!', timestamp: '2026-02-24T10:00:00Z' },
      { id: 's1m2', role: 'assistant', content: 'Why did the scarecrow win an award? Because he was outstanding in his field! But seriously, that joke is a classic for a reason. Got any topics you want me to riff on?', timestamp: '2026-02-24T10:00:30Z' },
      { id: 's1m3', role: 'user', content: 'That was great! How about a programming joke?', timestamp: '2026-02-24T10:01:00Z' },
      { id: 's1m4', role: 'assistant', content: 'A SQL query walks into a bar, walks up to two tables and asks... "Can I join you?" Classic developer humor right there. The best part is watching non-programmers try to figure out why it is funny.', timestamp: '2026-02-24T10:01:30Z' },
    ],
    createdAt: '2026-02-24T10:00:00Z',
    updatedAt: '2026-02-24T10:01:30Z',
  },
  {
    id: 'sample-2',
    title: 'Need some advice',
    messages: [
      { id: 's2m1', role: 'user', content: 'I need advice about starting a new hobby.', timestamp: '2026-02-24T08:00:00Z' },
      { id: 's2m2', role: 'assistant', content: "That is awesome that you are looking to pick up a new hobby! What kind of things interest you? Are you more into creative stuff like painting or music, something physical like hiking or rock climbing, or maybe something more cerebral like chess or coding? Knowing what excites you will help me suggest the perfect fit.", timestamp: '2026-02-24T08:00:30Z' },
      { id: 's2m3', role: 'user', content: 'I think something creative. I have always been curious about photography.', timestamp: '2026-02-24T08:01:00Z' },
      { id: 's2m4', role: 'assistant', content: "Photography is a fantastic choice! Here is what I would suggest to get started:\n\n**Start with your phone** -- modern smartphones have amazing cameras, so you do not need expensive gear right away.\n\n**Learn the basics** -- understand composition (rule of thirds), lighting (golden hour is your best friend), and perspective.\n\n**Practice daily** -- even taking one intentional photo a day builds your eye for interesting shots.\n\n**Join a community** -- there are great photography groups online where you can share work and get feedback.\n\nThe best part about photography is that it makes you notice beauty in everyday things you would normally walk right past.", timestamp: '2026-02-24T08:01:30Z' },
    ],
    createdAt: '2026-02-24T08:00:00Z',
    updatedAt: '2026-02-24T08:01:30Z',
  },
  {
    id: 'sample-3',
    title: 'How is your day going?',
    messages: [
      { id: 's3m1', role: 'user', content: 'Hey! How is your day going?', timestamp: '2026-02-24T11:00:00Z' },
      { id: 's3m2', role: 'assistant', content: "Hey there! Thanks for asking -- I am doing great! I have been having interesting conversations all day, which is basically my favorite thing. How about you? What is going on in your world today?", timestamp: '2026-02-24T11:00:30Z' },
    ],
    createdAt: '2026-02-24T11:00:00Z',
    updatedAt: '2026-02-24T11:00:30Z',
  },
]

const SUGGESTION_CHIPS = [
  { label: 'Tell me a joke', icon: FiSmile },
  { label: 'How is your day?', icon: FiMessageCircle },
  { label: 'I need advice', icon: FiHeart },
  { label: 'Let us chat about something fun', icon: FiRefreshCw },
]

// ---- Helpers ----

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

function getRelativeTime(dateStr: string): string {
  try {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    if (isNaN(then)) return ''
    const diff = now - then
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return ''
  }
}

function truncateText(str: string, maxLen: number): string {
  if (!str) return ''
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen) + '...'
}

// ---- Markdown Renderer ----

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm leading-relaxed">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// ---- localStorage helpers ----

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveConversations(convos: Conversation[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convos))
  } catch {
    // storage full or unavailable
  }
}

// ---- Typing Indicator Component ----

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
        <FiCpu className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-card border border-border shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1s' }} />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1s' }} />
        </div>
      </div>
    </div>
  )
}

// ---- Message Bubble Component ----

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex items-end gap-2.5 mb-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
          <FiCpu className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className={cn('max-w-[75%] min-w-[60px]')}>
        <div
          className={cn(
            'px-4 py-3 rounded-2xl shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-card border border-border text-card-foreground rounded-bl-md',
            message.error && !isUser && 'border-destructive/50 bg-destructive/5'
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-sm">{renderMarkdown(message.content)}</div>
          )}
        </div>
        <p className={cn('text-[10px] mt-1 text-muted-foreground/70 px-1', isUser ? 'text-right' : 'text-left')}>
          {getRelativeTime(message.timestamp)}
        </p>
      </div>
    </div>
  )
}

// ---- Welcome Card Component ----

function WelcomeCard({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 h-full">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <FiSmile className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Hey! I am your AI friend.
        </h2>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
          What is on your mind? I am here to chat, share a laugh, give advice, or just keep you company.
        </p>
        <div className="flex flex-wrap gap-2.5 justify-center">
          {SUGGESTION_CHIPS.map((chip) => {
            const Icon = chip.icon
            return (
              <button
                key={chip.label}
                onClick={() => onSuggestionClick(chip.label)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-card hover:bg-secondary hover:border-primary/30 text-sm font-medium text-foreground transition-all duration-200 hover:shadow-md cursor-pointer"
              >
                <Icon className="w-3.5 h-3.5 text-primary" />
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---- Sidebar Component ----

function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
  isMobile,
}: {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onClose: () => void
  isMobile: boolean
}) {
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'hsl(350, 28%, 95%)' }}>
      {/* Sidebar Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiHeart className="w-5 h-5 text-primary" />
          <span className="text-lg font-semibold text-foreground tracking-tight">ChatterPal</span>
        </div>
        {isMobile && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <FiX className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <div className="px-3 pb-3">
        <Button onClick={onNew} className="w-full gap-2 rounded-xl shadow-sm" size="sm">
          <FiPlus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      <Separator className="bg-border/60" />

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sorted.length === 0 && (
            <div className="px-3 py-8 text-center">
              <FiMessageCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
            </div>
          )}
          {sorted.map((convo) => {
            const msgs = Array.isArray(convo.messages) ? convo.messages : []
            const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null
            const isActive = activeId === convo.id

            return (
              <div
                key={convo.id}
                className={cn(
                  'group flex items-start gap-2 p-2.5 rounded-xl cursor-pointer transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-secondary/70 border border-transparent'
                )}
                onClick={() => {
                  onSelect(convo.id)
                  if (isMobile) onClose()
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', isActive ? 'text-primary' : 'text-foreground')}>
                    {convo.title || 'New Chat'}
                  </p>
                  {lastMsg && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {truncateText(lastMsg.content ?? '', 40)}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {getRelativeTime(convo.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(convo.id)
                  }}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all flex-shrink-0"
                  aria-label="Delete conversation"
                >
                  <FiTrash2 className="w-3.5 h-3.5 text-destructive/70" />
                </button>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Agent Info Footer */}
      <Separator className="bg-border/60" />
      <div className="p-3">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-secondary/50">
          <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <FiCpu className="w-3 h-3 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-foreground truncate">Friend Agent</p>
            <p className="text-[10px] text-muted-foreground">AI Conversational Friend</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- ErrorBoundary ----

class InlineErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---- Main Page Component ----

export default function Page() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sampleDataOn, setSampleDataOn] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const loaded = loadConversations()
    if (loaded.length > 0) {
      setConversations(loaded)
      const sorted = [...loaded].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      setActiveConvoId(sorted[0]?.id ?? null)
    }
  }, [])

  // Save to localStorage when conversations change
  useEffect(() => {
    if (mounted && !sampleDataOn) {
      saveConversations(conversations)
    }
  }, [conversations, mounted, sampleDataOn])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  })

  // Get active conversation
  const displayConversations = sampleDataOn ? SAMPLE_CONVERSATIONS : conversations
  const activeConvo = displayConversations.find((c) => c.id === activeConvoId) ?? null
  const activeMessages = Array.isArray(activeConvo?.messages) ? activeConvo.messages : []

  // Create new conversation
  const handleNewChat = useCallback(() => {
    if (sampleDataOn) return
    const newConvo: Conversation = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setConversations((prev) => [newConvo, ...prev])
    setActiveConvoId(newConvo.id)
    setInputValue('')
    setSidebarOpen(false)
  }, [sampleDataOn])

  // Delete conversation
  const handleDeleteConvo = useCallback(
    (id: string) => {
      if (sampleDataOn) return
      setConversations((prev) => {
        const updated = prev.filter((c) => c.id !== id)
        if (activeConvoId === id) {
          const sorted = [...updated].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          setActiveConvoId(sorted[0]?.id ?? null)
        }
        return updated
      })
    },
    [activeConvoId, sampleDataOn]
  )

  // Send message
  const handleSend = useCallback(
    async (overrideMessage?: string) => {
      const messageText = (overrideMessage ?? inputValue).trim()
      if (!messageText || isLoading || sampleDataOn) return

      let convoIdToUse = activeConvoId

      // If no active conversation, create one
      if (!convoIdToUse) {
        const newConvo: Conversation = {
          id: generateId(),
          title: truncateText(messageText, 30),
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        convoIdToUse = newConvo.id
        setConversations((prev) => [newConvo, ...prev])
        setActiveConvoId(newConvo.id)
      }

      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString(),
      }

      const targetId = convoIdToUse

      // Add user message and update title if first message
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetId) return c
          const existingMsgs = Array.isArray(c.messages) ? c.messages : []
          const updatedMessages = [...existingMsgs, userMsg]
          const title = existingMsgs.length === 0 ? truncateText(messageText, 30) : c.title
          return {
            ...c,
            messages: updatedMessages,
            title,
            updatedAt: new Date().toISOString(),
          }
        })
      )

      setInputValue('')
      setIsLoading(true)
      setActiveAgentId(AGENT_ID)

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      try {
        const result = await callAIAgent(messageText, AGENT_ID, {
          session_id: targetId,
        })

        let aiText = ''
        if (result.success && result.response) {
          aiText =
            result.response?.result?.response ||
            extractText(result.response) ||
            'Sorry, I could not process that. Can you try again?'
        } else {
          aiText = result.error || 'Oops, something went wrong. Let me try again!'
        }

        const aiMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: aiText,
          timestamp: new Date().toISOString(),
          error: !result.success,
        }

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== targetId) return c
            return {
              ...c,
              messages: [...(Array.isArray(c.messages) ? c.messages : []), aiMsg],
              updatedAt: new Date().toISOString(),
            }
          })
        )
      } catch {
        const errorMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: 'Oops, could not reach your friend. Try again?',
          timestamp: new Date().toISOString(),
          error: true,
        }

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== targetId) return c
            return {
              ...c,
              messages: [...(Array.isArray(c.messages) ? c.messages : []), errorMsg],
              updatedAt: new Date().toISOString(),
            }
          })
        )
      } finally {
        setIsLoading(false)
        setActiveAgentId(null)
      }
    },
    [inputValue, isLoading, activeConvoId, sampleDataOn]
  )

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (text: string) => {
      if (sampleDataOn) return
      handleSend(text)
    },
    [handleSend, sampleDataOn]
  )

  // Retry last failed message
  const handleRetry = useCallback(() => {
    if (!activeConvo || sampleDataOn) return
    const msgs = Array.isArray(activeConvo.messages) ? activeConvo.messages : []
    // Find last user message
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]?.role === 'user') {
        const retryText = msgs[i].content
        // Remove the error assistant message(s) after the last user message
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== activeConvo.id) return c
            const existing = Array.isArray(c.messages) ? c.messages : []
            // Keep messages up to and including the last user message at index i
            return { ...c, messages: existing.slice(0, i + 1) }
          })
        )
        // Re-send the user message content (but don't re-add it since we kept it)
        // Instead, directly call the agent
        setIsLoading(true)
        setActiveAgentId(AGENT_ID)
        callAIAgent(retryText, AGENT_ID, { session_id: activeConvo.id })
          .then((result) => {
            let aiText = ''
            if (result.success && result.response) {
              aiText =
                result.response?.result?.response ||
                extractText(result.response) ||
                'Sorry, I could not process that. Can you try again?'
            } else {
              aiText = result.error || 'Oops, something went wrong. Let me try again!'
            }
            const aiMsg: Message = {
              id: generateId(),
              role: 'assistant',
              content: aiText,
              timestamp: new Date().toISOString(),
              error: !result.success,
            }
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== activeConvo.id) return c
                return {
                  ...c,
                  messages: [...(Array.isArray(c.messages) ? c.messages : []), aiMsg],
                  updatedAt: new Date().toISOString(),
                }
              })
            )
          })
          .catch(() => {
            const errorMsg: Message = {
              id: generateId(),
              role: 'assistant',
              content: 'Oops, could not reach your friend. Try again?',
              timestamp: new Date().toISOString(),
              error: true,
            }
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== activeConvo.id) return c
                return {
                  ...c,
                  messages: [...(Array.isArray(c.messages) ? c.messages : []), errorMsg],
                  updatedAt: new Date().toISOString(),
                }
              })
            )
          })
          .finally(() => {
            setIsLoading(false)
            setActiveAgentId(null)
          })
        break
      }
    }
  }, [activeConvo, sampleDataOn])

  // Handle textarea keydown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // Toggle sample data
  const handleSampleToggle = (checked: boolean) => {
    setSampleDataOn(checked)
    if (checked) {
      setActiveConvoId(SAMPLE_CONVERSATIONS[0]?.id ?? null)
    } else {
      const loaded = loadConversations()
      setConversations(loaded)
      const sorted = [...loaded].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      setActiveConvoId(sorted[0]?.id ?? null)
    }
  }

  // Check for last message error
  const lastMessage = activeMessages.length > 0 ? activeMessages[activeMessages.length - 1] : null
  const hasError = lastMessage?.error === true && lastMessage?.role === 'assistant'

  return (
    <InlineErrorBoundary>
      <div
        className="min-h-screen h-screen flex overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsl(350, 35%, 97%) 0%, hsl(340, 30%, 95%) 35%, hsl(330, 25%, 96%) 70%, hsl(355, 30%, 97%) 100%)',
        }}
      >
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={cn(
            'fixed md:relative z-50 md:z-auto h-full transition-transform duration-300 ease-in-out w-[280px] flex-shrink-0 border-r border-border/50',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          )}
        >
          <ChatSidebar
            conversations={displayConversations}
            activeId={activeConvoId}
            onSelect={(id) => setActiveConvoId(id)}
            onNew={handleNewChat}
            onDelete={handleDeleteConvo}
            onClose={() => setSidebarOpen(false)}
            isMobile={sidebarOpen}
          />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {/* Chat Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-border/40"
            style={{
              backgroundColor: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors md:hidden"
              >
                <FiMenu className="w-5 h-5 text-foreground" />
              </button>
              <div className="flex items-center gap-2">
                <FiHeart className="w-5 h-5 text-primary" />
                <h1 className="text-lg font-semibold text-foreground tracking-tight">ChatterPal</h1>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground font-medium">Online</span>
              </div>
            </div>

            {/* Sample Data Toggle */}
            <div className="flex items-center gap-2">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer select-none">
                Sample Data
              </Label>
              <Switch
                id="sample-toggle"
                checked={sampleDataOn}
                onCheckedChange={handleSampleToggle}
              />
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto">
            {activeMessages.length === 0 && !isLoading ? (
              <WelcomeCard onSuggestionClick={handleSuggestionClick} />
            ) : (
              <div className="max-w-3xl mx-auto px-4 py-6">
                {activeMessages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {isLoading && <TypingIndicator />}
                {hasError && !isLoading && (
                  <div className="flex items-center justify-center mb-4">
                    <button
                      onClick={handleRetry}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/15 transition-colors cursor-pointer"
                    >
                      <FiRefreshCw className="w-3.5 h-3.5" />
                      Retry message
                    </button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="px-4 pb-4 pt-2">
            <div className="max-w-3xl mx-auto">
              <div
                className="flex items-end gap-2 p-2 rounded-2xl shadow-md"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  disabled={isLoading || sampleDataOn}
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
                  style={{ maxHeight: '120px' }}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isLoading || sampleDataOn}
                  size="sm"
                  className="rounded-xl h-10 w-10 p-0 flex-shrink-0"
                >
                  {isLoading ? (
                    <FiRefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FiSend className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 text-center mt-2 select-none">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>

        {/* Agent Activity Indicator (bottom-left, minimal) */}
        {activeAgentId && (
          <div className="fixed bottom-6 left-6 z-30 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border shadow-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-muted-foreground font-medium">Friend Agent responding...</span>
          </div>
        )}
      </div>
    </InlineErrorBoundary>
  )
}
