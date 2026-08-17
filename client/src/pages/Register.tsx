import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calendar, Lock, Mail, User, AlertCircle, Phone, Eye, EyeOff } from 'lucide-react';

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return setError('Địa chỉ email không đúng định dạng.');
    }

    if (phone) {
      const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
      if (!phoneRegex.test(phone.trim())) {
        return setError('Số điện thoại Việt Nam không hợp lệ (phải bắt đầu bằng 0 và có 10 chữ số).');
      }
    }

    if (password.length < 6) {
      return setError('Mật khẩu phải dài tối thiểu 6 ký tự.');
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return setError('Mật khẩu của bạn chưa đủ mạnh (phải chứa cả chữ cái và chữ số).');
    }

    if (password !== confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp.');
    }

    setLoading(true);
    try {
      const { default: api } = await import('../services/api');
      await api.post('/auth/register', { username, email, password, phone });
      alert('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Đăng ký thất bại. Email hoặc tên đăng nhập có thể đã tồn tại.');
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
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/30 mb-4 transition-transform hover:scale-105">
            <Calendar size={24} />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Tạo tài khoản</h2>
          <p className="mt-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Bắt đầu lập kế hoạch công việc khoa học cùng Planify</p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-red-50 p-3.5 text-xs font-semibold text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/20">
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Tên đăng nhập <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                className="w-full rounded-xl border border-slate-200 bg-white/40 py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-500"
                placeholder="hoang"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <Mail size={18} />
              </span>
              <input
                type="email"
                required
                className="w-full rounded-xl border border-slate-200 bg-white/40 py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-500"
                placeholder="hoang@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Số điện thoại (tùy chọn)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <Phone size={18} />
              </span>
              <input
                type="tel"
                className="w-full rounded-xl border border-slate-200 bg-white/40 py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-500"
                placeholder="0912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                Mật khẩu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white/40 py-2.5 pl-11 pr-11 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-500"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                Xác nhận <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white/40 py-2.5 pl-11 pr-11 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-500"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-2xl bg-blue-600 py-3.5 mt-5 text-sm font-bold text-white shadow-xl shadow-blue-500/20 transition hover:bg-blue-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              'Đăng ký tài khoản'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 ml-1">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
