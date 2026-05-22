type PinMap = Record<string, string>;

function storageKey(userId: string) {
  return `nex_pinned_conversations:${userId}`;
}

export function readLocalPins(userId: string): PinMap {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PinMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeLocalPin(userId: string, conversationId: string, pinned: boolean) {
  const pins = readLocalPins(userId);
  if (pinned) {
    pins[conversationId] = new Date().toISOString();
  } else {
    delete pins[conversationId];
  }
  localStorage.setItem(storageKey(userId), JSON.stringify(pins));
}

export function clearLocalPin(userId: string, conversationId: string) {
  const pins = readLocalPins(userId);
  delete pins[conversationId];
  localStorage.setItem(storageKey(userId), JSON.stringify(pins));
}

export function applyLocalPins<T extends { id: string; is_pinned?: boolean; pinned_at?: string | null }>(
  userId: string,
  conversations: T[],
): T[] {
  const pins = readLocalPins(userId);
  return conversations.map(conv => {
    const pinnedAt = pins[conv.id];
    if (!pinnedAt) return conv;
    return {
      ...conv,
      is_pinned: true,
      pinned_at: conv.pinned_at || pinnedAt,
    };
  });
}

export function isMissingPinColumnError(message?: string) {
  if (!message) return false;
  return message.includes('is_pinned') || message.includes('pinned_at');
}
