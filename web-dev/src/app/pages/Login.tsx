import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Droplets, Eye, EyeOff, Leaf, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function Login() {
  const { login, isAuthenticated, isAuthReady, authMode } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthReady && isAuthenticated) navigate('/overview', { replace: true });
  }, [isAuthReady, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username, password);
    if (result.ok) {
      navigate('/overview', { replace: true });
    } else {
      setError(result.error ?? '登录失败，请重试');
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: 'linear-gradient(135deg, #0d1f2d 0%, #0f2d1a 50%, #0d1f2d 100%)' }}
    >
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 200 + i * 60,
                height: 200 + i * 60,
                border: '1px solid #22c55e',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10">
            <div
              className="flex items-center justify-center rounded-2xl"
              style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #16a34a, #0ea5e9)' }}
            >
              <Droplets size={30} color="white" />
            </div>
            <div>
              <div style={{ color: '#ffffff', fontSize: 26, fontWeight: 700 }}>智慧灌溉管理平台</div>
              <div style={{ color: '#64748b', fontSize: 14 }}>Smart Irrigation Management System</div>
            </div>
          </div>

          <h1 style={{ color: '#ffffff', fontSize: 38, fontWeight: 700, lineHeight: 1.2, marginBottom: 20 }}>
            精准灌溉<br />
            <span style={{ color: '#22c55e' }}>数字农业</span>新时代
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.8, maxWidth: 420 }}>
            集地块管理、轮灌调度、传感监测、智能策略于一体的专业农业灌溉管理系统，
            助力农业生产节水增效。
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {[
              { icon: Leaf, label: '智能策略', desc: 'ETc/阈值双模型自动决策' },
              { icon: Droplets, label: '精准灌溉', desc: '按时长/定量双模式执行' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-4">
                <div
                  className="flex items-center justify-center rounded-xl shrink-0"
                  style={{ width: 44, height: 44, background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
                >
                  <Icon size={22} color="#22c55e" />
                </div>
                <div>
                  <div style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 500 }}>{label}</div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex items-center justify-center w-full lg:w-auto lg:min-w-[480px] px-8">
        <div
          className="w-full max-w-sm rounded-2xl p-8"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #16a34a, #0ea5e9)' }}
            >
              <Droplets size={22} color="white" />
            </div>
            <span style={{ color: '#ffffff', fontSize: 18, fontWeight: 600 }}>智慧灌溉平台</span>
          </div>

          <div className="mb-8">
            <h2 style={{ color: '#ffffff', fontSize: 24, fontWeight: 600, marginBottom: 6 }}>欢迎回来</h2>
            <p style={{ color: '#64748b', fontSize: 14 }}>登录您的工作台账户</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6, display: 'block' }}>邮箱</label>
              <input
                type="email"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="请输入登录邮箱"
                className="w-full rounded-xl px-4 py-3 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  fontSize: 14,
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(34,197,94,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>

            <div>
              <label style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6, display: 'block' }}>密码</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full rounded-xl px-4 py-3 pr-12 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#ffffff',
                    fontSize: 14,
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(34,197,94,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#64748b' }}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <AlertCircle size={16} color="#f87171" />
                <span style={{ color: '#f87171', fontSize: 13 }}>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !isAuthReady}
              className="w-full py-3 rounded-xl transition-all mt-2"
              style={{
                background: loading || !isAuthReady ? 'rgba(22,163,74,0.5)' : 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 600,
                cursor: loading || !isAuthReady ? 'not-allowed' : 'pointer',
                boxShadow: loading || !isAuthReady ? 'none' : '0 4px 20px rgba(22,163,74,0.4)',
              }}
            >
              {loading ? '登录中...' : !isAuthReady ? '初始化中...' : '登录工作台'}
            </button>
          </form>

          <div className="mt-6 text-center" style={{ color: '#475569', fontSize: 12 }}>
            {authMode === 'supabase'
              ? '使用 Supabase Auth 中已创建的邮箱和密码登录'
              : '未检测到 Supabase 环境变量，请先配置 web-dev/.env'}
          </div>

          <div className="mt-4 text-center" style={{ color: '#94a3b8', fontSize: 13 }}>
            还没有账户？
            <Link to="/register" style={{ color: '#22c55e', marginLeft: 6, fontWeight: 600 }}>
              立即注册
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
