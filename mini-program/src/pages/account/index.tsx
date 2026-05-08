import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { useEffect, useState } from 'react';
import type { MiniMeResponse } from '@irrigation/api';
import { AppIcon } from '@/components/AppIcon';
import { logoutCurrentSession } from '@/services/auth';
import { runtimeConfig } from '@/services/config';
import { loadMiniMe, loadRuntimeInfo } from '@/services/dataService';

function dataSourceLabel() {
  return runtimeConfig.useMockData ? 'mock' : 'node';
}

function formatHostLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}

export default function AccountPage() {
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight ?? 20;
  const [me, setMe] = useState<MiniMeResponse>({
    user: {
      id: 'mock-user',
      name: '张三',
      role: '系统管理员',
    },
    project: {
      id: 'mock-project',
      name: '智慧农场A',
    },
  });
  const [runtime, setRuntime] = useState({
    version: '0.1.0',
    apiBaseUrl: runtimeConfig.executionServiceUrl,
    dataSource: dataSourceLabel() as 'mock' | 'node' | 'supabase',
  });

  useEffect(() => {
    Promise.all([loadMiniMe(), loadRuntimeInfo()])
      .then(([meData, runtimeData]) => {
        setMe(meData);
        setRuntime(runtimeData);
      })
      .catch(() => {
        // keep fallback content for local preview
      });
  }, []);

  async function handleLogout() {
    if (runtimeConfig.useMockData) {
      Taro.showToast({ title: '当前为 mock 模式', icon: 'none' });
      return;
    }

    await logoutCurrentSession();
    Taro.reLaunch({ url: '/pages/login/index' });
  }

  return (
    <View className="account-page">
      <View className="account-hero" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
        <View className="account-hero-main">
          <View className="account-avatar">
            <AppIcon name="user" size={32} className="icon-white" />
          </View>
          <View className="account-hero-text">
            <Text className="account-name">{me.user.name}</Text>
            <Text className="account-role">{me.user.role ?? '运维人员'}</Text>
          </View>
        </View>
      </View>

      <View className="account-stack">
        <View className="account-project-card">
          <View className="account-project-main">
            <View className="account-project-icon">
              <AppIcon name="building2" size={20} className="icon-blue" />
            </View>
            <View className="account-project-text">
              <Text className="account-project-label">当前项目</Text>
              <Text className="account-project-value">{me.project?.name ?? '未分配项目'}</Text>
            </View>
          </View>
          <View className="account-switch-link">
            <Text>切换</Text>
            <AppIcon name="chevronRight" size={16} className="icon-blue" />
          </View>
        </View>

        <View className="account-section-card">
          <View className="account-section-head">账户信息</View>
          <View className="account-menu-row with-border">
            <View className="account-menu-main">
              <AppIcon name="user" size={20} className="icon-muted" />
              <Text className="account-menu-title">个人资料</Text>
            </View>
            <View className="account-menu-side">
              <Text className="account-menu-meta">{me.user.name}</Text>
              <AppIcon name="chevronRight" size={16} className="icon-muted" />
            </View>
          </View>
          <View className="account-menu-row">
            <View className="account-menu-main">
              <AppIcon name="building2" size={20} className="icon-muted" />
              <Text className="account-menu-title">当前项目</Text>
            </View>
            <View className="account-menu-side">
              <Text className="account-menu-meta">{me.project?.name ?? '未分配项目'}</Text>
              <AppIcon name="chevronRight" size={16} className="icon-muted" />
            </View>
          </View>
        </View>

        <View className="account-section-card">
          <View className="account-section-head">系统设置</View>
          <View className="account-menu-row with-border">
            <View className="account-menu-main">
              <AppIcon name="bell" size={20} className="icon-muted" />
              <Text className="account-menu-title">消息通知</Text>
            </View>
            <View className="account-menu-side">
              <Text className="account-menu-meta">3条新消息</Text>
              <AppIcon name="chevronRight" size={16} className="icon-muted" />
            </View>
          </View>
          <View className="account-menu-row with-border">
            <View className="account-menu-main">
              <AppIcon name="smartphone" size={20} className="icon-muted" />
              <Text className="account-menu-title">应用版本</Text>
            </View>
            <View className="account-menu-side">
              <Text className="account-menu-meta">v{runtime.version}</Text>
              <AppIcon name="chevronRight" size={16} className="icon-muted" />
            </View>
          </View>
          <View className="account-menu-row">
            <View className="account-menu-main">
              <AppIcon name="helpCircle" size={20} className="icon-muted" />
              <Text className="account-menu-title">帮助与反馈</Text>
            </View>
            <View className="account-menu-side">
              <Text className="account-menu-meta">查看</Text>
              <AppIcon name="chevronRight" size={16} className="icon-muted" />
            </View>
          </View>
        </View>

        <View className="account-section-card">
          <View className="account-section-head">开发运维</View>
          <View className="account-menu-row with-border">
            <View className="account-menu-main">
              <AppIcon name="database" size={20} className="icon-muted" />
              <Text className="account-menu-title">当前数据源</Text>
            </View>
            <View className="account-menu-side">
              <Text className="account-menu-meta">{runtime.dataSource}</Text>
              <AppIcon name="chevronRight" size={16} className="icon-muted" />
            </View>
          </View>
          <View className="account-menu-row with-border">
            <View className="account-menu-main">
              <AppIcon name="settings" size={20} className="icon-muted" />
              <Text className="account-menu-title">Node服务地址</Text>
            </View>
            <View className="account-menu-side">
              <Text className="account-menu-meta">{formatHostLabel(runtimeConfig.executionServiceUrl)}</Text>
              <AppIcon name="chevronRight" size={16} className="icon-muted" />
            </View>
          </View>
          <View className="account-menu-row">
            <View className="account-menu-main">
              <AppIcon name="radio" size={20} className="icon-muted" />
              <Text className="account-menu-title">网关状态</Text>
            </View>
            <View className="account-menu-side">
              <Text className="account-menu-meta">正常</Text>
              <AppIcon name="chevronRight" size={16} className="icon-muted" />
            </View>
          </View>
        </View>

        <View className="account-logout-card" onClick={handleLogout}>
          <AppIcon name="logOut" size={20} className="icon-red" />
          <Text className="account-logout-text">退出登录</Text>
        </View>

        <View className="account-footer">
          <Text className="account-footer-text">智能灌溉管理系统</Text>
          <Text className="account-footer-text">© 2026 All Rights Reserved</Text>
        </View>
      </View>
    </View>
  );
}
