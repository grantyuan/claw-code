import { writable, derived } from 'svelte/store';
import type { Message, Conversation, StreamChunk } from '$types/message';
import { MessageType } from '$types/message';

interface ChatState {
  conversations: Map<string, Conversation>;
  activeConversation: string | null;
  streamingMessage: string;
  streamingMessageId: string | null;
  isStreaming: boolean;
}

const defaultState: ChatState = {
  conversations: new Map(),
  activeConversation: null,
  streamingMessage: '',
  streamingMessageId: null,
  isStreaming: false,
};

function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>(defaultState);

  return {
    subscribe,

    createConversation: (id: string, agentId: string, title?: string) => {
      update(state => {
        const conversations = new Map(state.conversations);
        conversations.set(id, {
          id,
          title: title || `Conversation ${conversations.size + 1}`,
          messages: [],
          agentId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return { ...state, conversations, activeConversation: id };
      });
    },

    setActiveConversation: (id: string | null) => {
      update(state => ({ ...state, activeConversation: id }));
    },

    addMessage: (conversationId: string, message: Message) => {
      update(state => {
        const conversations = new Map(state.conversations);
        const conversation = conversations.get(conversationId);
        if (conversation) {
          conversation.messages.push(message);
          conversation.updatedAt = new Date();
          conversations.set(conversationId, { ...conversation });
        }
        return { ...state, conversations };
      });
    },

    startStreaming: (messageId: string) => {
      update(state => ({
        ...state,
        streamingMessage: '',
        streamingMessageId: messageId,
        isStreaming: true,
      }));
    },

    appendStreamChunk: (chunk: StreamChunk) => {
      update(state => {
        if (state.streamingMessageId === chunk.messageId) {
          return {
            ...state,
            streamingMessage: state.streamingMessage + chunk.chunk,
            isStreaming: !chunk.isComplete,
          };
        }
        return state;
      });
    },

    finishStreaming: (conversationId: string, message: Message) => {
      update(state => {
        const conversations = new Map(state.conversations);
        const conversation = conversations.get(conversationId);
        if (conversation) {
          conversation.messages.push(message);
          conversation.updatedAt = new Date();
          conversations.set(conversationId, { ...conversation });
        }
        return {
          ...state,
          conversations,
          streamingMessage: '',
          streamingMessageId: null,
          isStreaming: false,
        };
      });
    },

    clearConversation: (id: string) => {
      update(state => {
        const conversations = new Map(state.conversations);
        const conversation = conversations.get(id);
        if (conversation) {
          conversation.messages = [];
          conversation.updatedAt = new Date();
          conversations.set(id, { ...conversation });
        }
        return { ...state, conversations };
      });
    },

    deleteConversation: (id: string) => {
      update(state => {
        const conversations = new Map(state.conversations);
        conversations.delete(id);
        return {
          ...state,
          conversations,
          activeConversation: state.activeConversation === id ? null : state.activeConversation,
        };
      });
    },

    sendMessage: (conversationId: string, content: string) => {
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const message: Message = {
        id: messageId,
        conversationId,
        type: MessageType.User,
        content,
        timestamp: new Date(),
      };
      
      update(state => {
        const conversations = new Map(state.conversations);
        const conversation = conversations.get(conversationId);
        if (conversation) {
          conversation.messages.push(message);
          conversation.updatedAt = new Date();
          conversations.set(conversationId, { ...conversation });
        }
        return { ...state, conversations };
      });

      return messageId;
    },

    reset: () => set(defaultState),
  };
}

export const chatStore = createChatStore();

export const activeConversation = derived(chatStore, $chat => {
  if (!$chat.activeConversation) return null;
  return $chat.conversations.get($chat.activeConversation) || null;
});

export const messageList = derived(chatStore, $chat => {
  if (!$chat.activeConversation) return [];
  const conversation = $chat.conversations.get($chat.activeConversation);
  return conversation?.messages || [];
});
