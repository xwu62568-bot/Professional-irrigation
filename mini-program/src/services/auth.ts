import Taro from '@tarojs/taro';
import type { ApiEnvelope, MiniLoginResponse } from '@irrigation/api';
import { runtimeConfig } from './config';
import { miniApi } from './endpoints';

const SESSION_TOKEN_KEY = 'mini_access_token';
const SESSION_EXPIRES_AT_KEY = 'mini_access_token_expires_at';

function getStoredToken() {
  return Taro.getStorageSync<string>(SESSION_TOKEN_KEY) ?? '';
}

function getStoredExpiry() {
  return Taro.getStorageSync<string>(SESSION_EXPIRES_AT_KEY) ?? '';
}

function isTokenValid(token: string, expiresAt: string) {
  if (!token || !expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now() + 30_000;
}

function storeSession(session: MiniLoginResponse) {
  Taro.setStorageSync(SESSION_TOKEN_KEY, session.accessToken);
  Taro.setStorageSync(SESSION_EXPIRES_AT_KEY, session.expiresAt);
}

export function clearSession() {
  Taro.removeStorageSync(SESSION_TOKEN_KEY);
  Taro.removeStorageSync(SESSION_EXPIRES_AT_KEY);
}

export function getAccessToken() {
  const token = getStoredToken();
  const expiresAt = getStoredExpiry();
  return isTokenValid(token, expiresAt) ? token : '';
}

export function hasValidSession() {
  return Boolean(getAccessToken());
}

function mapLoginErrorMessage(statusCode: number, code?: string, message?: string) {
  if (code === 'AUTH_MISSING_CREDENTIALS') return '请输入账号和密码';
  if (code === 'AUTH_INVALID_CREDENTIALS') return message || '账号或密码错误';
  if (code === 'AUTH_UPSTREAM_TIMEOUT') return '认证服务超时，请稍后重试';
  if (code === 'AUTH_UPSTREAM_UNAVAILABLE') return '认证服务暂时不可用，请稍后重试';
  if (code === 'AUTH_UPSTREAM_REJECTED') return message || '认证服务返回异常，请稍后重试';
  if (code === 'AUTH_SESSION_STORE_FAILED') return '登录会话创建失败，请稍后重试';

  if (statusCode === 400) return message || '登录参数有误';
  if (statusCode === 401) return message || '账号或密码错误';
  if (statusCode === 502) return message || '认证服务暂时不可用';
  if (statusCode === 504) return message || '认证服务响应超时';
  if (statusCode >= 500) return message || '登录服务异常，请稍后重试';
  return message || '登录失败';
}

export async function loginWithCredentials(email: string, password: string) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail || !password) {
    throw new Error('请输入账号和密码');
  }

  let response;
  try {
    response = await Taro.request<ApiEnvelope<MiniLoginResponse> | { error?: string; code?: string }>({
      url: `${runtimeConfig.executionServiceUrl}${miniApi.authLogin}`,
      method: 'POST',
      data: { email: normalizedEmail, password },
      timeout: 12000,
      header: {
        'content-type': 'application/json',
      },
    });
  } catch (error) {
    const errMsg = error && typeof error === 'object' && 'errMsg' in error ? String(error.errMsg ?? '') : '';
    if (/timeout/i.test(errMsg)) {
      throw new Error('网络超时，请检查网络后重试');
    }
    if (/fail/i.test(errMsg)) {
      throw new Error('网络不可用或服务地址不可达');
    }
    throw new Error('登录请求发送失败，请稍后重试');
  }

  if (response.statusCode >= 400) {
    const payload = response.data as { error?: string; code?: string };
    throw new Error(mapLoginErrorMessage(response.statusCode, payload?.code, payload?.error));
  }

  const session = response.data?.data;
  if (!session?.accessToken) {
    throw new Error('登录失败，服务未返回 accessToken');
  }

  storeSession(session);
  return session;
}

export async function loginWithConfiguredCredentials() {
  const email = runtimeConfig.authEmail.trim();
  const password = runtimeConfig.authPassword;

  if (!email || !password) {
    throw new Error('未配置小程序调试登录账号，请先登录或填写 runtimeConfig 中的 authEmail/authPassword');
  }

  return loginWithCredentials(email, password);
}

export async function ensureAuthenticated() {
  const token = getAccessToken();
  if (token) {
    return token;
  }

  const session = await loginWithConfiguredCredentials();
  return session.accessToken;
}

export async function logoutCurrentSession() {
  const token = getAccessToken();
  if (token) {
    await Taro.request({
      url: `${runtimeConfig.executionServiceUrl}${miniApi.authLogout}`,
      method: 'POST',
      timeout: 8000,
      header: {
        authorization: `Bearer ${token}`,
      },
    }).catch(() => undefined);
  }

  clearSession();
}
