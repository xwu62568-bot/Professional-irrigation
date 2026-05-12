import test from 'node:test';
import assert from 'node:assert/strict';

import { createAssistantService } from './assistant-service.mjs';

test('sendMessage forwards the prompt to Dify streaming chat API', async () => {
  const calls = [];
  const service = createAssistantService({
    difyBaseUrl: 'https://dify.example.com/v1',
    difyApiKey: 'secret-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response([
        'data: {"event":"message","conversation_id":"conversation-1","message_id":"message-1","answer":"assistant "}\n\n',
        'data: {"event":"message","conversation_id":"conversation-1","message_id":"message-1","answer":"reply"}\n\n',
        'data: {"event":"message_end","conversation_id":"conversation-1","message_id":"message-1","created_at":1710000000}\n\n',
      ].join(''), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    },
  });

  const result = await service.sendMessage({
    query: 'Hello',
    userId: 'mini-user-1',
    conversationId: 'conversation-0',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://dify.example.com/v1/chat-messages');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.authorization, 'Bearer secret-key');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    inputs: {},
    query: 'Hello',
    user: 'mini-user-1',
    response_mode: 'streaming',
    conversation_id: 'conversation-0',
  });
  assert.deepEqual(result, {
    conversationId: 'conversation-1',
    messageId: 'message-1',
    answer: 'assistant reply',
    createdAt: 1710000000,
  });
});

test('streamMessage emits incremental deltas and final payload', async () => {
  const progress = [];
  const service = createAssistantService({
    difyBaseUrl: 'https://dify.example.com/v1',
    difyApiKey: 'secret-key',
    fetchImpl: async () => new Response([
      'data: {"event":"message","conversation_id":"conversation-1","message_id":"message-1","answer":"hello "}\n\n',
      'data: {"event":"message","conversation_id":"conversation-1","message_id":"message-1","answer":"world"}\n\n',
      'data: {"event":"message_end","conversation_id":"conversation-1","message_id":"message-1","created_at":1710000001}\n\n',
    ].join(''), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }),
  });

  const result = await service.streamMessage({
    query: 'Hello',
    userId: 'mini-user-1',
    conversationId: 'conversation-0',
    onDelta: (event) => {
      progress.push({ delta: event.delta, answer: event.answer });
    },
  });

  assert.deepEqual(progress, [
    { delta: 'hello ', answer: 'hello ' },
    { delta: 'world', answer: 'hello world' },
  ]);
  assert.deepEqual(result, {
    conversationId: 'conversation-1',
    messageId: 'message-1',
    answer: 'hello world',
    createdAt: 1710000001,
  });
});

test('sendMessage omits empty conversation id and surfaces upstream errors', async () => {
  const service = createAssistantService({
    difyBaseUrl: 'https://dify.example.com/v1/',
    difyApiKey: 'secret-key',
    fetchImpl: async (_url, options) => {
      assert.equal(JSON.parse(options.body).conversation_id, undefined);
      return new Response(JSON.stringify({ message: 'bad request' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await assert.rejects(
    () => service.sendMessage({ query: 'Hello', userId: 'mini-user-1', conversationId: '' }),
    /bad request/,
  );
});

test('sendMessage surfaces SSE error events', async () => {
  const service = createAssistantService({
    difyBaseUrl: 'https://dify.example.com/v1',
    difyApiKey: 'secret-key',
    fetchImpl: async () => new Response(
      'data: {"event":"error","message":"stream failed"}\n\n',
      {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      },
    ),
  });

  await assert.rejects(
    () => service.sendMessage({ query: 'Hello', userId: 'mini-user-1', conversationId: '' }),
    /stream failed/,
  );
});
