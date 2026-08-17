import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Calendar, Lock, User, AlertCircle, Eye, EyeOff, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Forgot password states
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(emailOrUsername, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Tài khoản hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotSuccess(null);
    setLoading(true);

    try {
      const { default: api } = await import('../services/api');
      const res = await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotSuccess(res.data.message);
      setForgotEmail('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi gửi email khôi phục.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-[#05070c]">
      {/* Aurora Blobs */}
      <div className="aurora-bg">
        <div className="aurora-blob bg-blue-200/50 dark:bg-blue-900/20 w-96 h-96 -top-20 -left-20"></div>
        <div className="aurora-blob bg-indigo-200/40 dark:bg-indigo-900/15 w-[500px] h-[500px] -bottom-40 -right-20"></div>
        <div className="aurora-blob bg-violet-200/40 dark:bg-violet-900/15 w-80 h-80 top-40 right-40"></div>
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-white/50 bg-white/70 p-9 shadow-[0_20px_50px_-12px_rgba(37,99,235,0.08)] backdrop-blur-2xl dark:border-white/5 dark:bg-slate-900/60 dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
        {!forgotMode ? (
          <>
            <div className="flex flex-col items-center mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/30 mb-4 transition-transform hover:scale-105">
                <Calendar size={24} />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Chào mừng trở lại</h2>
              <p className="mt-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Đăng nhập để tiếp tục quản lý công việc và lịch trình</p>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-xs font-semibold text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/20">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                  Email hoặc Tên đăng nhập <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white/40 py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-500"
                    placeholder="hoang@example.com hoặc hoang"
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <Lock size={18} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white/40 py-3.5 pl-11 pr-11 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-500"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-500 dark:text-slate-400 font-semibold">
                  <input type="checkbox" className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950" />
                  <span>Ghi nhớ tài khoản</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setError(null);
                    setForgotSuccess(null);
                  }}
                  className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 transition"
                >
                  Quên mật khẩu?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-500/20 transition hover:bg-blue-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/30 mb-4 transition-transform hover:scale-105">
                <Lock size={24} />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Khôi phục mật khẩu</h2>
              <p className="mt-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Chúng tôi sẽ tạo mật khẩu ngẫu nhiên mới và gửi trực tiếp tới email của bạn</p>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-xs font-semibold text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/20">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20">
                <CheckCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                  Email đăng ký <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white/40 py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-500"
                    placeholder="hoang@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-500/20 transition hover:bg-blue-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  'Gửi yêu cầu khôi phục'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setError(null);
                  setForgotSuccess(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-850"
              >
                <ArrowLeft size={16} />
                Quay lại đăng nhập
              </button>
            </form>
          </>
        )}

        <p className="mt-8 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 ml-1">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
