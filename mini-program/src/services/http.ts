import Taro from '@tarojs/taro';
import type { ApiEnvelope } from '@irrigation/api';
import { clearSession, ensureAuthenticated } from './auth';
import { runtimeConfig } from './config';

function joinUrl(path: string) {
  return `${runtimeConfig.executionServiceUrl}${path}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = await ensureAuthenticated();
  const response = await Taro.request<ApiEnvelope<T> | { error?: string }>({
    url: joinUrl(path),
    method: 'GET',
    timeout: 12000,
    header: {
      authorization: `Bearer ${token}`,
    },
  });

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

export async function apiPost<T>(path: string, data?: unknown): Promise<T> {
  const token = await ensureAuthenticated();
  const response = await Taro.request<ApiEnvelope<T> | { error?: string }>({
    url: joinUrl(path),
    method: 'POST',
    timeout: 12000,
    data,
    header: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
  });

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
  const response = await Taro.request<ApiEnvelope<T> | { error?: string }>({
    url: joinUrl(path),
    method: 'PATCH',
    timeout: 12000,
    data,
    header: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
  });

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
