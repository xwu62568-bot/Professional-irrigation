import Taro, { useLoad } from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { hasValidSession, loginWithCredentials } from '@/services/auth';
import { runtimeConfig } from '@/services/config';

function goHome() {
  Taro.switchTab({ url: '/pages/index/index' });
}

export default function LoginPage() {
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight ?? 20;
  const [email, setEmail] = useState(runtimeConfig.authEmail);
  const [password, setPassword] = useState(runtimeConfig.authPassword);
  const [submitting, setSubmitting] = useState(false);

  useLoad(() => {
    if (runtimeConfig.useMockData || hasValidSession()) {
      goHome();
    }
  });

  async function handleLogin() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await loginWithCredentials(email, password);
      Taro.showToast({ title: '登录成功', icon: 'success' });
      goHome();
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '登录失败',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="login-page">
      <View className="login-hero" style={{ paddingTop: `${statusBarHeight + 32}px` }}>
        <View className="login-brand-mark">
          <AppIcon name="droplets" size={24} className="icon-white" />
        </View>
        <Text className="login-title">智能灌溉系统</Text>
        <Text className="login-subtitle">小程序运维端登录</Text>
      </View>

      <View className="login-card">
        <View className="login-card-title">账号登录</View>

        <View className="login-field">
          <Text className="login-label">账号</Text>
          <Input
            className="login-input"
            type="text"
            placeholder="请输入邮箱账号"
            value={email}
            onInput={(event) => setEmail(event.detail.value)}
          />
        </View>

        <View className="login-field">
          <Text className="login-label">密码</Text>
          <Input
            className="login-input"
            password
            placeholder="请输入密码"
            value={password}
            onInput={(event) => setPassword(event.detail.value)}
          />
        </View>

        <Button
          className="login-submit"
          loading={submitting}
          disabled={submitting}
          onClick={handleLogin}
        >
          登录
        </Button>

        <View className="login-hint">
          <Text>当前阶段使用 Node 代理 Supabase 登录，后续切换微信登录。</Text>
        </View>
      </View>
    </View>
  );
}
