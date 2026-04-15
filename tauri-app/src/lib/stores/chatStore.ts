import { writable, derived } from 'svelte/store';
import type { Message, Conversation, StreamChunk } from '$types/message';
import { MessageType } from '$types/message';
import { apiService } from '$services/apiService';
import { sessionStore } from '$stores/sessionStore';
import { toastStore } from '$stores/toastStore';

interface ChatState {
  conversations: Map<string, Conversation>;
  activeConversation: string | null;
  streamingMessage: string;
  streamingMessageId: string | null;
  isStreaming: boolean;
  lastError: string | null;
}

const defaultState: ChatState = {
  conversations: new Map(),
  activeConversation: null,
  streamingMessage: '',
  streamingMessageId: null,
  isStreaming: false,
  lastError: null,
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
        return { ...state, conversations, activeConversation: id, lastError: null };
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
        lastError: null,
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
      const userMessage: Message = {
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
          conversation.messages.push(userMessage);
          conversation.updatedAt = new Date();
          conversations.set(conversationId, { ...conversation });
        }
        return { ...state, conversations, isStreaming: true, lastError: null };
      });

      const aiMessageId = `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      update(state => ({
        ...state,
        streamingMessageId: aiMessageId,
        streamingMessage: '',
      }));

      (async () => {
        try {
          let sessionId = 'default';
          sessionStore.subscribe(state => {
            if (state.activeSessionId) sessionId = state.activeSessionId;
          })();
          const response = await apiService.sendMessage(content, sessionId);

          const aiMessage: Message = {
            id: aiMessageId,
            conversationId,
            type: MessageType.AI,
            content: response.content || response.message || response.text || JSON.stringify(response),
            timestamp: new Date(),
          };

          update(state => {
            const conversations = new Map(state.conversations);
            const conversation = conversations.get(conversationId);
            if (conversation) {
              conversation.messages.push(aiMessage);
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
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);

          const errorMessage: Message = {
            id: aiMessageId,
            conversationId,
            type: MessageType.Error,
            content: `Failed to get response: ${errorMsg}`,
            timestamp: new Date(),
          };

          update(state => {
            const conversations = new Map(state.conversations);
            const conversation = conversations.get(conversationId);
            if (conversation) {
              conversation.messages.push(errorMessage);
              conversation.updatedAt = new Date();
              conversations.set(conversationId, { ...conversation });
            }
            return {
              ...state,
              conversations,
              streamingMessage: '',
              streamingMessageId: null,
              isStreaming: false,
              lastError: errorMsg,
            };
          });

          toastStore.addToast({
            type: 'error',
            message: `Message failed: ${errorMsg}`,
            duration: 5000,
          });
        }
      })();

      return messageId;
    },

    clearError: () => {
      update(state => ({ ...state, lastError: null }));
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
