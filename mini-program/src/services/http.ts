import Taro from '@tarojs/taro';
import type { ApiEnvelope } from '@irrigation/api';
import { clearSession, ensureAuthenticated } from './auth';
import { runtimeConfig } from './config';

function joinUrl(path: string) {
  return `${runtimeConfig.executionServiceUrl}${path}`;
}

function toRequestError(error: unknown, fallbackMessage: string) {
  const errMsg = error && typeof error === 'object' && 'errMsg' in error ? String(error.errMsg ?? '') : '';

  if (/timeout/i.test(errMsg)) {
    return new Error('网络超时，请稍后重试');
  }
  if (/refused|ECONNREFUSED/i.test(errMsg)) {
    return new Error('服务未启动或当前地址不可达');
  }
  if (/ssl|tls|certificate/i.test(errMsg)) {
    return new Error('安全连接失败，请检查网络或证书配置');
  }
  if (/fail/i.test(errMsg)) {
    return new Error(`请求发送失败：${errMsg || fallbackMessage}`);
  }

  return new Error(fallbackMessage);
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = await ensureAuthenticated();
  let response;
  try {
    response = await Taro.request<ApiEnvelope<T> | { error?: string }>({
      url: joinUrl(path),
      method: 'GET',
      timeout: 12000,
      header: {
        authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    throw toRequestError(error, 'GET 请求发送失败');
  }

  if (response.statusCode === 401) {
    clearSession();
    throw new Error((response.data as { error?: string })?.error ?? '登录已失效，请重新登录');
  }

  const envelope = response.data as ApiEnvelope<T>;
  if (!envelope?.data) {
    throw new Error((response.data as { error?: string })?.error ?? '请求失败');
  }

  return envelope.data;
}

interface RequestOptions {
  timeout?: number;
}

export async function apiPost<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
  const token = await ensureAuthenticated();
  let response;
  try {
    response = await Taro.request<ApiEnvelope<T> | { error?: string }>({
      url: joinUrl(path),
      method: 'POST',
      timeout: options?.timeout ?? 12000,
      data,
      header: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    throw toRequestError(error, 'POST 请求发送失败');
  }

  if (response.statusCode === 401) {
    clearSession();
    throw new Error((response.data as { error?: string })?.error ?? '登录已失效，请重新登录');
  }

  const envelope = response.data as ApiEnvelope<T>;
  if (!envelope?.data) {
    throw new Error((response.data as { error?: string })?.error ?? '请求失败');
  }

  return envelope.data;
}

export async function apiPatch<T>(path: string, data?: unknown): Promise<T> {
  const token = await ensureAuthenticated();
  let response;
  try {
    response = await Taro.request<ApiEnvelope<T> | { error?: string }>({
      url: joinUrl(path),
      method: 'PATCH',
      timeout: 12000,
      data,
      header: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    throw toRequestError(error, 'PATCH 请求发送失败');
  }

  if (response.statusCode === 401) {
    clearSession();
    throw new Error((response.data as { error?: string })?.error ?? '登录已失效，请重新登录');
  }

  const envelope = response.data as ApiEnvelope<T>;
  if (!envelope?.data) {
    throw new Error((response.data as { error?: string })?.error ?? '请求失败');
  }

  return envelope.data;
}
