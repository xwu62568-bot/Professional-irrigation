export const aiAssistantChatbotUrl = __WEB_AI_ASSISTANT_CHATBOT_URL__.trim();

export function isHttpUrl(value: string) {
  return /^http:\/\//i.test(value);
}
