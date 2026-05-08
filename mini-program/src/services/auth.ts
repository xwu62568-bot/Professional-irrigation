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

export async function loginWithCredentials(email: string, password: string) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail || !password) {
    throw new Error('请输入账号和密码');
  }

  const response = await Taro.request<ApiEnvelope<MiniLoginResponse>>({
    url: `${runtimeConfig.executionServiceUrl}${miniApi.authLogin}`,
    method: 'POST',
    data: { email: normalizedEmail, password },
    timeout: 12000,
    header: {
      'content-type': 'application/json',
    },
  });

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
