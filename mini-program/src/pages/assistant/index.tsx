import Taro from '@tarojs/taro';
import { Button, Input, ScrollView, Text, View } from '@tarojs/components';
import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { sendAssistantMessageStream } from '@/services/dataService';

type AssistantRole = 'assistant' | 'user';

interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  createdAt: number;
}

const STORAGE_KEY = 'mini_assistant_state_v1';

function createWelcomeMessage(): AssistantMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: '你好，我是灌溉智能助手。你可以直接问我灌溉建议、设备状态、计划执行等问题。',
    createdAt: Math.floor(Date.now() / 1000),
  };
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function AssistantPage() {
  const systemInfo = Taro.getSystemInfoSync();
  const safeBottom = systemInfo.safeArea
    ? Math.max(0, systemInfo.screenHeight - systemInfo.safeArea.bottom)
    : 0;
  const [messages, setMessages] = useState<AssistantMessage[]>([createWelcomeMessage()]);
  const [conversationId, setConversationId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [scrollIntoView, setScrollIntoView] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  function scrollToTail() {
    setScrollIntoView('');
    Taro.nextTick(() => {
      setScrollIntoView('assistant-message-tail');
    });
  }

  useEffect(() => {
    const savedState = Taro.getStorageSync(STORAGE_KEY) as
      | { conversationId?: string; messages?: AssistantMessage[] }
      | undefined;

    if (savedState?.messages?.length) {
      setMessages(savedState.messages);
      setConversationId(savedState.conversationId ?? '');
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    Taro.setStorageSync(STORAGE_KEY, {
      conversationId,
      messages,
    });
  }, [conversationId, hydrated, messages]);

  useEffect(() => {
    scrollToTail();
  }, [messages]);

  useEffect(() => {
    scrollToTail();
  }, [keyboardHeight]);

  useEffect(() => {
    const maybeOnKeyboardHeightChange = (Taro as typeof Taro & {
      onKeyboardHeightChange?: (callback: (payload: { height: number }) => void) => void;
      offKeyboardHeightChange?: (callback: (payload: { height: number }) => void) => void;
    });

    const handleKeyboardChange = ({ height }: { height: number }) => {
      setKeyboardHeight(height > 0 ? height : 0);
    };

    maybeOnKeyboardHeightChange.onKeyboardHeightChange?.(handleKeyboardChange);

    return () => {
      maybeOnKeyboardHeightChange.offKeyboardHeightChange?.(handleKeyboardChange);
    };
  }, []);

  async function handleSend() {
    const query = inputValue.trim();
    if (!query || sending) {
      return;
    }

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      createdAt: Math.floor(Date.now() / 1000),
    };
    const pendingAssistantId = `assistant-pending-${Date.now()}`;
    const pendingAssistantMessage: AssistantMessage = {
      id: pendingAssistantId,
      role: 'assistant',
      content: '正在生成回复...',
      createdAt: Math.floor(Date.now() / 1000),
    };

    setMessages((current) => [...current, userMessage, pendingAssistantMessage]);
    setInputValue('');
    setSending(true);

    try {
      const result = await sendAssistantMessageStream({
        query,
        conversationId,
      }, {
        onProgress: (progress) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === pendingAssistantId
                ? {
                    ...message,
                    content: progress.answer || '正在生成回复...',
                    createdAt: progress.createdAt,
                  }
                : message,
            ),
          );
        },
      });

      setConversationId(result.conversationId);
      setMessages((current) => [
        ...current.map((message) =>
          message.id === pendingAssistantId
            ? {
                ...message,
                id: result.messageId || pendingAssistantId,
                content: result.answer || '收到请求，但没有返回内容。',
                createdAt: result.createdAt,
              }
            : message,
        ),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '发送失败';
      setMessages((current) =>
        current.map((item) =>
          item.id === pendingAssistantId
            ? {
                ...item,
                id: `assistant-error-${Date.now()}`,
                content: `请求失败：${message}`,
                createdAt: Math.floor(Date.now() / 1000),
              }
            : item,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    setConversationId('');
    setMessages([createWelcomeMessage()]);
    Taro.removeStorageSync(STORAGE_KEY);
  }

  return (
    <View className="assistant-native-page">
      <View className="assistant-native-hero">
        <View className="assistant-native-eyebrow">
          <AppIcon name="botMessageSquare" size={14} className="icon-soft-blue" />
          <Text>AI 助手</Text>
        </View>
        <View className="assistant-native-title">灌溉智能助理</View>
        <View className="assistant-native-subtitle">
          直接提问即可获取灌溉建议、设备状态和计划执行信息。
        </View>
        <View className="assistant-native-actions">
          <Button className="assistant-native-reset" size="mini" onClick={handleReset}>
            新对话
          </Button>
        </View>
      </View>

      <ScrollView
        className="assistant-native-scroll"
        scrollY
        scrollWithAnimation
        scrollIntoView={scrollIntoView}
        enhanced
      >
        <View
          className="assistant-native-list"
          style={{ paddingBottom: `${112 + safeBottom + keyboardHeight}px` }}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              id={`assistant-message-${message.id}`}
              className={`assistant-native-item ${message.role === 'user' ? 'is-user' : 'is-assistant'}`}
            >
              <View className="assistant-native-meta">
                <Text>{message.role === 'user' ? '我' : '助手'}</Text>
                <Text>{formatTime(message.createdAt)}</Text>
              </View>
              <View className={`assistant-native-bubble ${message.role === 'user' ? 'is-user' : 'is-assistant'}`}>
                <Text>{message.content}</Text>
              </View>
            </View>
          ))}
          <View id="assistant-message-tail" className="assistant-native-tail" />
        </View>
      </ScrollView>

      <View
        className="assistant-native-composer"
        style={{ bottom: `${keyboardHeight}px`, paddingBottom: `${12 + safeBottom}px` }}
      >
        <Input
          className="assistant-native-input"
          type="text"
          maxlength={500}
          value={inputValue}
          placeholder="例如：今天哪些地块需要补水？"
          confirmType="send"
          onInput={(event) => setInputValue(event.detail.value)}
          onFocus={() => {
            setTimeout(() => {
              setScrollIntoView('assistant-message-tail');
            }, 60);
          }}
          onConfirm={() => {
            void handleSend();
          }}
        />
        <Button
          className="assistant-native-send"
          disabled={sending || !inputValue.trim()}
          onClick={() => {
            void handleSend();
          }}
        >
          发送
        </Button>
      </View>
    </View>
  );
}
