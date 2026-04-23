import { useNavigate } from 'react-router';
import {
  User, Mail, Shield, LogOut, Settings, Bell, Key, ChevronRight,
  Building, Clock, CheckCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export function Account() {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  const lastLoginTime = '2026-04-23 08:32:14';
  const sessionDuration = '2小时15分钟';

  return (
    <div className="flex flex-col h-full overflow-auto" style={{ background: '#f0f4f8' }}>
      {/* Header */}
      <div className="px-6 py-5" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <h1 style={{ color: '#0f172a', fontSize: 20, fontWeight: 700 }}>账户</h1>
        <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>管理您的账户信息与安全设置</p>
      </div>

      <div className="flex-1 p-6 max-w-3xl">
        {/* Profile card */}
        <div
          className="rounded-2xl p-6 mb-5"
          style={{
            background: 'linear-gradient(135deg, #0d1f2d 0%, #0f2d1a 100%)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          }}
        >
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div
              className="flex items-center justify-center rounded-2xl shrink-0"
              style={{
                width: 72, height: 72,
                background: 'linear-gradient(135deg, #16a34a, #0ea5e9)',
                fontSize: 24, color: '#ffffff', fontWeight: 700,
                boxShadow: '0 4px 16px rgba(22,163,74,0.4)',
              }}
            >
              {user.avatar}
            </div>
            {/* User info */}
            <div className="flex-1">
              <div style={{ color: '#ffffff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{user.displayName}</div>
              <div style={{ color: '#94a3b8', fontSize: 14 }}>@{user.username}</div>
              <div className="flex items-center gap-3 mt-3">
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background: 'rgba(22,163,74,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', fontSize: 13 }}
                >
                  <CheckCircle size={13} />
                  已验证账户
                </span>
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 13 }}
                >
                  <Shield size={13} />
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          {[
            { icon: User, label: '用户名', value: user.username, color: '#16a34a' },
            { icon: Mail, label: '邮箱地址', value: user.email, color: '#0ea5e9' },
            { icon: Shield, label: '账户角色', value: user.role, color: '#8b5cf6' },
            { icon: Building, label: '所属组织', value: '智慧农业科技有限公司', color: '#f59e0b' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="rounded-xl p-4"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 32, height: 32, background: `${color}15` }}
                >
                  <Icon size={16} color={color} />
                </div>
                <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
              </div>
              <div style={{ color: '#0f172a', fontSize: 14, fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Session info */}
        <div
          className="rounded-xl p-5 mb-5"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>当前会话</h3>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="rounded-full" style={{ width: 8, height: 8, background: '#22c55e' }} />
              <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 500 }}>会话活跃</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} color="#94a3b8" />
              <span style={{ color: '#64748b', fontSize: 13 }}>登录时间：{lastLoginTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} color="#94a3b8" />
              <span style={{ color: '#64748b', fontSize: 13 }}>在线时长：{sessionDuration}</span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div
          className="rounded-xl overflow-hidden mb-5"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>账户操作</h3>
          </div>
          {[
            { icon: Key, label: '修改密码', desc: '定期更新密码保护账户安全', color: '#3b82f6' },
            { icon: Bell, label: '通知设置', desc: '配置灌溉告警、策略通知', color: '#f59e0b' },
            { icon: Settings, label: '偏好设置', desc: '语言、时区、数据刷新频率', color: '#64748b' },
          ].map(({ icon: Icon, label, desc, color }) => (
            <button
              key={label}
              className="flex items-center gap-4 w-full px-5 py-4 transition-all text-left"
              style={{ borderBottom: '1px solid #f1f5f9' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{ width: 40, height: 40, background: `${color}15` }}
              >
                <Icon size={18} color={color} />
              </div>
              <div className="flex-1">
                <div style={{ color: '#0f172a', fontSize: 14, fontWeight: 500 }}>{label}</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{desc}</div>
              </div>
              <ChevronRight size={16} color="#94a3b8" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#ffffff', border: '1px solid #fecaca', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div style={{ color: '#0f172a', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>退出登录</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>退出后将清除当前会话，需重新登录</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all"
              style={{ background: '#ef4444', color: '#ffffff', fontSize: 14 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#dc2626')}
              onMouseLeave={e => (e.currentTarget.style.background = '#ef4444')}
            >
              <LogOut size={18} />
              退出登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
