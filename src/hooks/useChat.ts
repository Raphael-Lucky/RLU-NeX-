import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase, type Conversation, type Message } from '../lib/supabase';
import {
  applyLocalPins,
  clearLocalPin,
  isMissingPinColumnError,
  writeLocalPin,
} from '../lib/pinStorage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || SUPABASE_URL;
const HISTORY_LIMIT = 10;

function escapeIlikePattern(value: string) {
  return value.replace(/[%_\\]/g, '\\$&');
}

function conversationMatchesSearch(
  conv: Conversation,
  query: string,
  messageMatchIds: Set<string>,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  if (conv.title.toLowerCase().includes(normalized)) return true;
  if (normalized.length >= 2 && messageMatchIds.has(conv.id)) return true;
  return false;
}

function sortConversations(convs: Conversation[]): Conversation[] {
  return [...convs].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    if (a.is_pinned && b.is_pinned) {
      const aPin = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
      const bPin = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
      if (aPin !== bPin) return bPin - aPin;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export function useChat(userId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageMatchIds, setMessageMatchIds] = useState<Set<string>>(new Set());
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);

  const searchQueryRef = useRef(searchQuery);
  const abortRef = useRef<AbortController | null>(null);
  const tokenRef = useRef('');
  const streamRafRef = useRef<number | null>(null);
  const pendingStreamRef = useRef('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      tokenRef.current = data.session?.access_token || '';
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token || '';
    });
    return () => subscription.unsubscribe();
  }, []);

  const flushStreamingContent = useCallback(() => {
    if (streamRafRef.current !== null) return;
    streamRafRef.current = requestAnimationFrame(() => {
      streamRafRef.current = null;
      setStreamingContent(pendingStreamRef.current);
    });
  }, []);

  const loadConversations = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to load conversations:', error.message);
      return;
    }

    if (data) {
      const withPins = applyLocalPins(userId, data);
      setConversations(sortConversations(withPins));
    }
  }, [userId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setIsLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setIsLoading(false);
  }, []);

  const selectConversation = useCallback(async (conv: Conversation) => {
    setActiveConversation(conv);
    await loadMessages(conv.id);
  }, [loadMessages]);

  const startNewConversation = useCallback(() => {
    setActiveConversation(null);
    setMessages([]);
  }, []);

  // ✅ Stops the active stream, commits whatever partial content arrived
  const stopStreaming = useCallback(() => {
    if (!abortRef.current) return;

    abortRef.current.abort();
    abortRef.current = null;

    // Cancel any pending RAF flush
    if (streamRafRef.current !== null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }

    // Commit whatever streamed so far as a real message
    const partial = pendingStreamRef.current;
    if (partial) {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        conversation_id: activeConversation?.id ?? '',
        role: 'assistant',
        content: partial,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    }

    pendingStreamRef.current = '';
    setStreamingContent('');
    setIsTyping(false);
  }, [activeConversation]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !userId) return;

    // Cancel any existing stream before starting a new one
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const trimmed = content.trim();
    let convId = activeConversation?.id;

    if (!convId) {
      const title = trimmed.slice(0, 60) + (trimmed.length > 60 ? '...' : '');
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({ title, user_id: userId })
        .select()
        .single();
      if (error || !newConv) return;
      convId = newConv.id;
      setActiveConversation(newConv);
      setConversations(prev => [newConv, ...prev]);
    }

    if (!convId) return;

    const conversationId = convId;
    const optimisticUserMsg: Message = {
      id: `temp-user-${Date.now()}`,
      conversation_id: conversationId,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticUserMsg]);
    setIsTyping(true);
    setStreamingContent('');
    pendingStreamRef.current = '';

    const history = [
      ...messages.slice(-(HISTORY_LIMIT - 1)),
      optimisticUserMsg,
    ].map(m => ({ role: m.role, content: m.content }));

    // Persist user message in background
    supabase
      .from('messages')
      .insert({ conversation_id: conversationId, role: 'user', content: trimmed })
      .select()
      .single()
      .then(({ data: userMsg }) => {
        if (userMsg) {
          setMessages(prev =>
            prev.map(m => (m.id === optimisticUserMsg.id ? userMsg : m))
          );
        }
      });

    try {
      let token = tokenRef.current;
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || '';
        tokenRef.current = token;
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/functions/v1/nex-chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: history, conversationId }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Request failed');
      }

      const contentType = res.headers.get('content-type') || '';
      const isStreaming = contentType.includes('text/event-stream');

      if (isStreaming && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let sseBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.delta) {
                fullContent += parsed.delta;
                pendingStreamRef.current = fullContent;
                flushStreamingContent();
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }

        if (streamRafRef.current !== null) {
          cancelAnimationFrame(streamRafRef.current);
          streamRafRef.current = null;
        }

        if (fullContent) {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            conversation_id: conversationId,
            role: 'assistant',
            content: fullContent,
            created_at: new Date().toISOString(),
          };
          setMessages(prev => [...prev, assistantMsg]);
        }
      } else {
        const data = await res.json();
        if (data.content) {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            conversation_id: conversationId,
            role: 'assistant',
            content: data.content,
            created_at: new Date().toISOString(),
          };
          setMessages(prev => [...prev, assistantMsg]);
        }
      }

      if (messages.length === 0) {
        loadConversations();
      }
    } catch (err: unknown) {
      // AbortError is expected — stopStreaming already committed the partial message
      if (!(err instanceof Error && err.name === 'AbortError')) {
        console.error('Chat error:', err);
      }
    } finally {
      setIsTyping(false);
      setStreamingContent('');
      pendingStreamRef.current = '';
      abortRef.current = null;
    }
  }, [activeConversation, messages, loadConversations, userId, flushStreamingContent]);

  const deleteConversation = useCallback(async (convId: string) => {
    if (!userId) return;
    await supabase
      .from('conversations')
      .delete()
      .eq('id', convId)
      .eq('user_id', userId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConversation?.id === convId) {
      setActiveConversation(null);
      setMessages([]);
    }
  }, [activeConversation, userId]);

  const pinMessage = useCallback(async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    const isCurrentlyPinned = message.is_pinned || false;
    const { error } = await supabase
      .from('messages')
      .update({
        is_pinned: !isCurrentlyPinned,
        pinned_at: !isCurrentlyPinned ? new Date().toISOString() : null,
      })
      .eq('id', messageId);
    if (!error) {
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId
            ? { ...m, is_pinned: !isCurrentlyPinned, pinned_at: !isCurrentlyPinned ? new Date().toISOString() : null }
            : m
        )
      );
    }
  }, [messages]);

  const pinConversation = useCallback(async (convId: string) => {
    if (!userId) return;
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    const isCurrentlyPinned = conv.is_pinned || false;
    const nextPinned = !isCurrentlyPinned;
    const nextPinnedAt = nextPinned ? new Date().toISOString() : null;

    const { error } = await supabase
      .from('conversations')
      .update({ is_pinned: nextPinned, pinned_at: nextPinnedAt })
      .eq('id', convId)
      .eq('user_id', userId);

    if (error) {
      if (isMissingPinColumnError(error.message)) {
        writeLocalPin(userId, convId, nextPinned);
      } else {
        console.error('Failed to pin conversation:', error.message);
        return;
      }
    } else {
      clearLocalPin(userId, convId);
    }

    setConversations(prev =>
      sortConversations(
        prev.map(c =>
          c.id === convId ? { ...c, is_pinned: nextPinned, pinned_at: nextPinnedAt } : c
        )
      )
    );

    if (activeConversation?.id === convId) {
      setActiveConversation(prev =>
        prev ? { ...prev, is_pinned: nextPinned, pinned_at: nextPinnedAt } : null
      );
    }
  }, [conversations, userId, activeConversation]);

  const renameConversation = useCallback(async (convId: string, newTitle: string) => {
    if (!newTitle.trim() || !userId) return;
    const { error } = await supabase
      .from('conversations')
      .update({ title: newTitle.trim() })
      .eq('id', convId)
      .eq('user_id', userId);
    if (!error) {
      setConversations(prev =>
        prev.map(c => c.id === convId ? { ...c, title: newTitle.trim() } : c)
      );
      if (activeConversation?.id === convId) {
        setActiveConversation(prev => prev ? { ...prev, title: newTitle.trim() } : null);
      }
    }
  }, [activeConversation, userId]);

  searchQueryRef.current = searchQuery;

  useEffect(() => {
    const query = searchQuery.trim();
    if (!userId || query.length < 2) {
      setMessageMatchIds(new Set());
      setIsSearchingMessages(false);
      return;
    }

    setMessageMatchIds(new Set());
    setIsSearchingMessages(true);

    const conversationIds = conversations.map(c => c.id);
    if (conversationIds.length === 0) {
      setIsSearchingMessages(false);
      return;
    }

    const requestQuery = query;
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', conversationIds)
        .ilike('content', `%${escapeIlikePattern(requestQuery)}%`)
        .limit(100);

      if (searchQueryRef.current.trim() !== requestQuery) return;

      if (error) {
        console.error('Conversation search failed:', error.message);
        setMessageMatchIds(new Set());
      } else {
        setMessageMatchIds(
          new Set((data || []).map(row => row.conversation_id as string))
        );
      }
      setIsSearchingMessages(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery, userId, conversations]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter(conv =>
      conversationMatchesSearch(conv, searchQuery, messageMatchIds)
    );
  }, [conversations, searchQuery, messageMatchIds]);

  return {
    conversations: filteredConversations,
    searchQuery,
    setSearchQuery,
    isSearchingMessages,
    activeConversation,
    messages,
    isLoading,
    isTyping,
    streamingContent,
    loadConversations,
    selectConversation,
    startNewConversation,
    sendMessage,
    stopStreaming,        // ✅ newly exported
    deleteConversation,
    pinMessage,
    pinConversation,
    renameConversation,
  };
}