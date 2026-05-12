import { aiAssistantChatbotUrl } from '@/lib/aiAssistant';

export function MiniAiAssistant() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <iframe
        src={aiAssistantChatbotUrl}
        title="Dify AI 助手"
        className="h-full w-full border-0 bg-white"
        frameBorder="0"
        allow="microphone"
      />
    </div>
  );
}
