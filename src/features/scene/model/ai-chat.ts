import type { InteractionAiResult } from '@/shared/contracts/api/interaction-ai.schema';
import type { Asset } from '@/shared/contracts/dto.schema';
import type { AppliedAiPlan } from './ai-proposal';

export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    wireContent?: string;
    result?: InteractionAiResult;
    snapshot?: string;
    targetRuleId?: string;
    targetObjectId?: string;
    application?: AppliedAiPlan;
};
export type ChatReference = { key: string; start: number; end: number };
export type ChatSession = {
    messages: ChatMessage[];
    input: string;
    targetRuleId?: string;
    targetObjectId?: string;
    references?: ChatReference[];
    libraryAssets?: Asset[];
};

export function replaceChatInput(session: ChatSession, start: number, end: number, text: string) {
    const offset = text.length - (end - start);
    return {
        ...session,
        input: session.input.slice(0, start) + text + session.input.slice(end),
        references: (session.references ?? []).flatMap((reference) => {
            if (reference.end <= start) return [reference];
            if (reference.start >= end)
                return [
                    { ...reference, start: reference.start + offset, end: reference.end + offset },
                ];
            return [];
        }),
    };
}

export function editChatInput(session: ChatSession, input: string): ChatSession {
    if (!session.references?.length || input === session.input) return { ...session, input };
    const previous = session.input;
    let start = 0;
    while (start < previous.length && start < input.length && previous[start] === input[start])
        start++;
    let end = previous.length;
    let nextEnd = input.length;
    while (end > start && nextEnd > start && previous[end - 1] === input[nextEnd - 1]) {
        end--;
        nextEnd--;
    }
    return replaceChatInput(session, start, end, input.slice(start, nextEnd));
}

// shortcut: keep at most 50 author/page conversations in memory; add durable storage when cross-session history is needed.
const sessions = new Map<string, ChatSession>();
export function readChat(key: string): ChatSession {
    return sessions.get(key) ?? { messages: [], input: '' };
}
export function saveChat(key: string, session: ChatSession) {
    sessions.delete(key);
    sessions.set(key, session);
    if (sessions.size > 50) {
        const oldest = sessions.keys().next().value;
        if (oldest) sessions.delete(oldest);
    }
}
