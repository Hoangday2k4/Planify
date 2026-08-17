import React, { useState } from 'react';
import api from '../services/api';
import { Lock, Check, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const ChangePassword: React.FC = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!oldPassword) {
      return setError('Vui lòng nhập mật khẩu cũ.');
    }

    if (!newPassword) {
      return setError('Vui lòng nhập mật khẩu mới.');
    }

    if (newPassword.length < 6) {
      return setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
    }

    if (newPassword === oldPassword) {
      return setError('Mật khẩu mới không được trùng với mật khẩu cũ.');
    }

    if (newPassword !== confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp.');
    }

    setLoading(true);
    try {
      await api.put('/auth/change-password', {
        oldPassword: oldPassword.trim(),
        newPassword: newPassword.trim()
      });

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Thay đổi mật khẩu tài khoản thành công!');
    } catch (err: any) {
      console.error('Lỗi đổi mật khẩu:', err);
      setError(err.response?.data?.message || 'Không thể đổi mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3">
        <Link 
          to="/settings" 
          className="rounded-xl p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-850 dark:hover:bg-slate-800 transition"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Bảo mật tài khoản</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Đổi mật khẩu để tăng cường tính an toàn cho tài khoản của bạn</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 backdrop-blur-md space-y-6">
        <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <Lock size={18} className="text-violet-500" />
          Đổi mật khẩu mới
        </h3>

        {message && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20 animate-fade-in">
            <Check size={16} />
            {message}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/20">
            <ShieldAlert size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Mật khẩu hiện tại (mật khẩu cũ)</label>
            <input
              type="password"
              placeholder="Nhập mật khẩu hiện tại"
              required
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-500"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Mật khẩu mới</label>
            <input
              type="password"
              placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
              required
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-500"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              placeholder="Nhập lại mật khẩu mới để xác nhận"
              required
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-white dark:focus:border-blue-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-violet-500/20 hover:bg-violet-700 transition disabled:opacity-50"
          >
            <Lock size={15} />
            {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
