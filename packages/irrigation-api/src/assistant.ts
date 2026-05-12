export interface MiniAssistantSendMessageInput {
  query: string;
  conversationId?: string;
}

export interface MiniAssistantSendMessageResponse {
  conversationId: string;
  messageId: string;
  answer: string;
  createdAt: number;
}
