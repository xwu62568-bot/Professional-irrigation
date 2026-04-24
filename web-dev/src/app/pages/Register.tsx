import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertCircle, CheckCircle2, Droplets, Eye, EyeOff, Leaf } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../../lib/supabase';

export function Register() {
  const { isAuthenticated, isAuthReady, authMode } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthReady && isAuthenticated) {
      navigate('/overview', { replace: true });
    }
  }, [isAuthReady, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!supabase) {
      setError('Supabase 环境变量未配置，请先在 web-dev/.env 中填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。');
      return;
    }

    if (!email.trim()) {
      setError('请输入邮箱地址。');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要 6 位。');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致。');
      return;
    }

    setLoading(true);

    const redirectTo = `${window.location.origin}/login`;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          display_name: displayName.trim() || email.trim().split('@')[0],
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      navigate('/overview', { replace: true });
      return;
    }

    setSuccess('注册成功，请检查邮箱完成验证，然后返回登录页登录。');
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: 'linear-gradient(135deg, #0d1f2d 0%, #0f2d1a 50%, #0d1f2d 100%)' }}
    >
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 relative overflow-hidden">
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
            创建账户<br />
            <span style={{ color: '#22c55e' }}>开始接入</span>真实业务数据
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.8, maxWidth: 440 }}>
            先完成账号注册和认证，后续地块、计划、策略等页面就能逐步切到 Supabase 真数据。
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {[
              { icon: Leaf, label: '账号隔离', desc: 'RLS 已按用户维度隔离业务数据' },
              { icon: Droplets, label: '联调入口', desc: '注册后可直接开始真实认证和后续数据接入' },
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

      <div className="flex items-center justify-center w-full lg:w-auto lg:min-w-[520px] px-8 py-10">
        <div
          className="w-full max-w-md rounded-2xl p-8"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}
        >
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
            <h2 style={{ color: '#ffffff', fontSize: 24, fontWeight: 600, marginBottom: 6 }}>注册账户</h2>
            <p style={{ color: '#64748b', fontSize: 14 }}>创建一个新的工作台账号</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6, display: 'block' }}>显示名称</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="例如：张三"
                className="w-full rounded-xl px-4 py-3 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6, display: 'block' }}>邮箱</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="请输入邮箱地址"
                className="w-full rounded-xl px-4 py-3 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6, display: 'block' }}>密码</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  className="w-full rounded-xl px-4 py-3 pr-12 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#ffffff',
                    fontSize: 14,
                  }}
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

            <div>
              <label style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6, display: 'block' }}>确认密码</label>
              <div className="relative">
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  className="w-full rounded-xl px-4 py-3 pr-12 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#ffffff',
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#64748b' }}
                >
                  {showConfirmPwd ? <EyeOff size={18} /> : <Eye size={18} />}
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

            {success && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}
              >
                <CheckCircle2 size={16} color="#4ade80" />
                <span style={{ color: '#4ade80', fontSize: 13 }}>{success}</span>
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
              {loading ? '注册中...' : !isAuthReady ? '初始化中...' : '创建账户'}
            </button>
          </form>

          <div className="mt-6 text-center" style={{ color: '#475569', fontSize: 12 }}>
            {authMode === 'supabase'
              ? '注册完成后，是否需要邮箱确认取决于 Supabase Auth 配置'
              : '未检测到 Supabase 环境变量，请先配置 web-dev/.env'}
          </div>

          <div className="mt-4 text-center" style={{ color: '#94a3b8', fontSize: 13 }}>
            已有账户？
            <Link to="/login" style={{ color: '#22c55e', marginLeft: 6, fontWeight: 600 }}>
              返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
