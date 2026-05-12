import { Bot, ExternalLink, ShieldAlert } from 'lucide-react';
import { aiAssistantChatbotUrl, isHttpUrl } from '@/lib/aiAssistant';

export function AiAssistant() {
  const mixedContentRisk =
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    isHttpUrl(aiAssistantChatbotUrl);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#eef6fb_0%,#f8fbfd_52%,#edf7f1_100%)]">
      <div className="border-b border-slate-200/80 bg-white/88 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <Bot size={14} />
              AI 助手
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">灌溉智能助理</h1>
            <p className="mt-1 text-sm text-slate-600">
              通过 Dify 助手查询灌溉总览、计划与设备信息。支持语音输入。
            </p>
          </div>
          <a
            href={aiAssistantChatbotUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700"
          >
            新窗口打开
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-4 md:px-6 md:py-5">
        {mixedContentRisk && (
          <div className="mx-auto mb-4 flex w-full max-w-7xl items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            <div>
              当前页面如果通过 HTTPS 打开，浏览器可能会拦截这个 HTTP iframe。正式环境建议把 Dify 嵌入地址也切到 HTTPS，或通过同域反向代理转发。
            </div>
          </div>
        )}

        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-hidden rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.10)] md:p-3">
          <iframe
            src={aiAssistantChatbotUrl}
            title="Dify AI 助手"
            className="h-full min-h-[700px] w-full rounded-[22px] bg-white"
            frameBorder="0"
            allow="microphone"
          />
        </div>
      </div>
    </div>
  );
}
