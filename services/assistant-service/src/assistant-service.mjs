function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function encodeAsciiJsonLine(value) {
  return `${JSON.stringify(value).replace(/[\u0080-\uFFFF]/g, (char) =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)}\n`;
}

function errorDetails(error) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const cause = error.cause && typeof error.cause === 'object'
    ? {
        message: 'message' in error.cause ? String(error.cause.message) : undefined,
        code: 'code' in error.cause ? String(error.cause.code) : undefined,
        host: 'host' in error.cause ? String(error.cause.host) : undefined,
        port: 'port' in error.cause ? String(error.cause.port) : undefined,
      }
    : undefined;

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause,
  };
}

function parseSseDataBlocks(buffer) {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const completeBlocks = blocks.slice(0, -1);
  const remainder = blocks.at(-1) ?? '';

  return {
    remainder,
    payloads: completeBlocks
      .map((block) =>
        block
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n'),
      )
      .filter(Boolean),
  };
}

async function parseErrorMessage(response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null);
    if (body && typeof body === 'object') {
      if (typeof body.message === 'string' && body.message.trim()) {
        return body.message;
      }
      if (typeof body.error === 'string' && body.error.trim()) {
        return body.error;
      }
    }
  }

  const text = await response.text().catch(() => '');
  return text || `Dify request failed with status ${response.status}`;
}

async function parseStreamingResponse(response, handlers = {}) {
  if (!response.body) {
    throw new Error('Dify streaming response has no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let conversationId = '';
  let messageId = '';
  let createdAt = Math.floor(Date.now() / 1000);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseDataBlocks(buffer);
    buffer = parsed.remainder;

    for (const payload of parsed.payloads) {
      const event = JSON.parse(payload);
      if (event.event === 'error') {
        throw new Error(event.message || event.error || 'Dify streaming error');
      }

      if (typeof event.conversation_id === 'string' && event.conversation_id) {
        conversationId = event.conversation_id;
      }
      if (typeof event.message_id === 'string' && event.message_id) {
        messageId = event.message_id;
      }
      if (typeof event.created_at === 'number') {
        createdAt = event.created_at;
      }
      if (typeof event.answer === 'string') {
        answer += event.answer;
        handlers.onDelta?.({
          delta: event.answer,
          answer,
          conversationId,
          messageId,
          createdAt,
        });
      }
    }
  }

  if (buffer.trim()) {
    const finalPayload = buffer
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (finalPayload) {
      const event = JSON.parse(finalPayload);
      if (typeof event.conversation_id === 'string' && event.conversation_id) {
        conversationId = event.conversation_id;
      }
      if (typeof event.message_id === 'string' && event.message_id) {
        messageId = event.message_id;
      }
      if (typeof event.created_at === 'number') {
        createdAt = event.created_at;
      }
      if (typeof event.answer === 'string') {
        answer += event.answer;
        handlers.onDelta?.({
          delta: event.answer,
          answer,
          conversationId,
          messageId,
          createdAt,
        });
      }
      if (event.event === 'error') {
        throw new Error(event.message || event.error || 'Dify streaming error');
      }
    }
  }

  const result = {
    conversationId,
    messageId,
    answer,
    createdAt,
  };
  handlers.onDone?.(result);
  return result;
}

export function createAssistantService(config) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const difyBaseUrl = trimTrailingSlash(config.difyBaseUrl);
  const difyApiKey = String(config.difyApiKey ?? '').trim();

  return {
    encodeStreamEvent(event) {
      return encodeAsciiJsonLine(event);
    },

    async streamMessage({ query, userId, conversationId, onDelta, onDone }) {
      if (!difyApiKey) {
        throw new Error('未配置 DIFY_API_KEY');
      }

      const payload = {
        inputs: {},
        query,
        user: userId,
        response_mode: 'streaming',
      };

      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      try {
        const response = await fetchImpl(`${difyBaseUrl}/chat-messages`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${difyApiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const message = await parseErrorMessage(response);
          console.error('[assistant-service] dify chat-messages upstream error', {
            url: `${difyBaseUrl}/chat-messages`,
            status: response.status,
            contentType: response.headers.get('content-type'),
            message,
          });
          throw new Error(message);
        }

        return await parseStreamingResponse(response, { onDelta, onDone });
      } catch (error) {
        console.error('[assistant-service] dify chat-messages request failed', {
          url: `${difyBaseUrl}/chat-messages`,
          userId,
          details: errorDetails(error),
        });
        throw error;
      }
    },

    async sendMessage({ query, userId, conversationId }) {
      return this.streamMessage({ query, userId, conversationId });
    },
  };
}
