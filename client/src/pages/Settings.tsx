import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import UserAvatar from '../components/UserAvatar';
import { User as UserIcon, Tag, Plus, Check, Edit2, Save, X, Globe, Calendar, Upload, AlertTriangle } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  color: string;
  userId?: string;
}

const Settings: React.FC = () => {
  const { user, updateUserLocal } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#3b82f6');
  
  // Public calendar share states
  const [shareToken, setShareToken] = useState(user?.shareToken || null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(user?.shareExpiresAt || null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expireOption, setExpireOption] = useState<'NONE' | '1H' | '1D' | '7D' | 'CUSTOM'>('NONE');
  const [customExpireTime, setCustomExpireTime] = useState('');

  // Trạng thái bật/tắt form chỉnh sửa
  const [isEditing, setIsEditing] = useState(false);
  
  // State Form chỉnh sửa thông tin (Không bao gồm username và password)
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '');

  // Thông báo trạng thái
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [catLoading, setCatLoading] = useState(false);
  const [catMessage, setCatMessage] = useState<string | null>(null);

  const getExportUrl = () => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const cleanBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
    return `${cleanBase}/public/calendar/export/${user?.id}`;
  };

  const getWebcalUrl = () => {
    return getExportUrl().replace(/^https?:/, 'webcal:');
  };

  // Cập nhật các state khi user context thay đổi
  useEffect(() => {
    if (user) {
      setEditEmail(user.email);
      setEditPhone(user.phone || '');
      setEditAvatar(user.avatar || '');
      setShareToken(user.shareToken || null);
      setShareExpiresAt(user.shareExpiresAt || null);
    }
  }, [user]);

  const handleTogglePublicShare = async () => {
    setShareLoading(true);
    try {
      const willEnable = !shareToken;
      let expiresAt: string | null = null;

      if (willEnable) {
        const now = Date.now();
        if (expireOption === '1H') {
          expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
        } else if (expireOption === '1D') {
          expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
        } else if (expireOption === '7D') {
          expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (expireOption === 'CUSTOM' && customExpireTime) {
          expiresAt = new Date(customExpireTime).toISOString();
        }
      }

      const res = await api.put('/auth/profile/share-token', {
        enable: willEnable,
        expiresAt
      });
      const newToken = res.data.shareToken;
      const newExpiresAt = res.data.shareExpiresAt;
      setShareToken(newToken);
      setShareExpiresAt(newExpiresAt);
      if (user) {
        updateUserLocal({ ...user, shareToken: newToken, shareExpiresAt: newExpiresAt });
      }
    } catch (err) {
      console.error('Lỗi bật/tắt lịch công khai:', err);
    } finally {
      setShareLoading(false);
    }
  };

  const getShareUrl = () => {
    return `${window.location.origin}/public-calendar/${shareToken}`;
  };

  const handleCopyUrl = () => {
    if (!shareToken) return;
    navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Lỗi lấy danh mục:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Tệp tin ảnh quá lớn (tối đa 5MB).');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setProfileLoading(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const res = await api.post('/auth/upload-avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setEditAvatar(res.data.avatarUrl);
      setProfileMessage('Tải ảnh đại diện lên thành công! Hãy lưu lại thay đổi.');
    } catch (err: any) {
      console.error('Lỗi upload avatar:', err);
      setProfileError(err.response?.data?.message || 'Không thể tải ảnh đại diện lên.');
    } finally {
      setProfileLoading(false);
    }
  };

  // Xử lý cập nhật thông tin (Email, Số điện thoại, Avatar)
  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage(null);
    setProfileError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail)) {
      setProfileError('Địa chỉ email không đúng định dạng.');
      setProfileLoading(false);
      return;
    }

    if (editPhone) {
      const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
      if (!phoneRegex.test(editPhone.trim())) {
        setProfileError('Số điện thoại Việt Nam không hợp lệ (phải bắt đầu bằng 0 và có 10 chữ số).');
        setProfileLoading(false);
        return;
      }
    }

    try {
      const res = await api.put('/auth/profile', {
        username: user?.username, // Gửi username cũ (Backend yêu cầu không để trống, nhưng tuyệt đối không đổi)
        email: editEmail.trim(),
        phone: editPhone.trim() || null,
        avatar: editAvatar.trim() || null
      });

      const { user: updatedUser } = res.data;
      updateUserLocal(updatedUser);
      setIsEditing(false); // Trở về màn hình hiển thị tĩnh
      setProfileMessage('Cập nhật thông tin cá nhân thành công!');
    } catch (err: any) {
      console.error('Lỗi cập nhật hồ sơ:', err);
      setProfileError(err.response?.data?.message || 'Không thể cập nhật thông tin cá nhân.');
    } finally {
      setProfileLoading(false);
    }
  };


  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setCatLoading(true);
    setCatMessage(null);
    try {
      await api.post('/categories', {
        name: catName.trim(),
        color: catColor
      });
      setCatName('');
      setCatColor('#3b82f6');
      setCatMessage('Tạo danh mục mới thành công!');
      fetchCategories();
    } catch (err) {
      console.error('Lỗi tạo danh mục:', err);
      setCatMessage('Không thể tạo danh mục mới.');
    } finally {
      setCatLoading(false);
    }
  };

  const presetColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1',
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Cài đặt hệ thống</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Quản lý hồ sơ, bảo mật tài khoản và danh mục công việc</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* VÙNG TRÁI: THÔNG TIN HỒ SƠ & CHIA SẺ LỊCH & ĐỒNG BỘ LỊCH */}
        <div className="space-y-8">
          {/* CARD HỒ SƠ CÁ NHÂN */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 backdrop-blur-md space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                <UserIcon size={18} className="text-blue-500" />
                Thông tin tài khoản
              </h3>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition"
                >
                  <Edit2 size={13} />
                  Chỉnh sửa
                </button>
              )}
            </div>

            {profileMessage && (
              <div className="rounded-xl bg-blue-50/50 p-3 text-xs font-bold text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/20">
                {profileMessage}
              </div>
            )}

            {profileError && (
              <div className="rounded-xl bg-red-50/50 p-3 text-xs font-bold text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100/50 dark:border-red-900/20 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                {profileError}
              </div>
            )}

            {!isEditing ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <UserAvatar 
                    username={user?.username} 
                    avatarUrl={user?.avatar} 
                    sizeClass="h-20 w-20" 
                    textClass="text-3xl font-black"
                  />
                  <div className="space-y-1.5 text-center sm:text-left flex-1">
                    <h4 className="text-lg font-black text-slate-800 dark:text-white">{user?.username}</h4>
                    <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                      Vai trò: {user?.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800/40">
                    <span className="text-slate-500 font-medium">Email</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500 font-medium">Số điện thoại</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.phone || 'Chưa cập nhật'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdateInfo} className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/40 mb-6">
                  <UserAvatar 
                    username={user?.username} 
                    avatarUrl={editAvatar} 
                    sizeClass="h-20 w-20" 
                    textClass="text-3xl font-black"
                  />
                  <div className="space-y-1.5 text-center sm:text-left flex-1">
                    <h4 className="text-lg font-black text-slate-800 dark:text-white">{user?.username}</h4>
                    <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                      Vai trò: {user?.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      Địa chỉ Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Số điện thoại</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Chưa cập nhật"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Ảnh đại diện (Avatar)</label>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <input
                        type="text"
                        value={editAvatar}
                        onChange={(e) => setEditAvatar(e.target.value)}
                        placeholder="Đường dẫn ảnh URL hoặc chọn tải file bên phải"
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                      />
                      <label className="flex items-center justify-center gap-2 rounded-xl bg-blue-55 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 px-4 py-2 text-xs font-extrabold text-blue-600 cursor-pointer transition select-none border border-blue-200/50 dark:border-blue-900/30">
                        <Upload size={14} />
                        Tải tệp ảnh
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setEditEmail(user?.email || '');
                      setEditPhone(user?.phone || '');
                      setEditAvatar(user?.avatar || '');
                      setIsEditing(false);
                    }}
                    className="flex items-center gap-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <X size={15} />
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="flex items-center gap-1.5 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Save size={15} />
                    {profileLoading ? 'Đang lưu...' : 'Lưu lại'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* CARD CHIA SẺ LỊCH BIỂU CÔNG KHAI */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 backdrop-blur-md space-y-6">
            <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Globe size={18} className="text-blue-500" />
              Chia sẻ lịch biểu công khai
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Kích hoạt tính năng này để cho phép người khác xem lịch trình của bạn mà không cần tài khoản đăng nhập. Các sự kiện sẽ chỉ hiển thị các thông tin cơ bản (tiêu đề, thời gian, địa điểm, mô tả, màu sắc, danh mục) để bảo mật.
            </p>

            <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-950/20 border border-slate-100/50 dark:border-slate-850">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Bật chia sẻ lịch biểu công khai</span>
              <button
                onClick={handleTogglePublicShare}
                disabled={shareLoading}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  shareToken ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    shareToken ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {!shareToken && (
              <div className="space-y-4 rounded-2xl bg-slate-50/30 p-4 border border-slate-100 dark:bg-slate-950/10 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Thời hạn liên kết chia sẻ</label>
                  <select
                    value={expireOption}
                    onChange={(e) => setExpireOption(e.target.value as any)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition focus:border-blue-500"
                  >
                    <option value="NONE">Vô thời hạn (Không hết hạn)</option>
                    <option value="1H">1 giờ</option>
                    <option value="1D">1 ngày</option>
                    <option value="7D">7 ngày</option>
                    <option value="CUSTOM">Tùy chọn thời gian khác</option>
                  </select>
                </div>

                {expireOption === 'CUSTOM' && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Chọn ngày & giờ hết hạn</label>
                    <input
                      type="datetime-local"
                      required
                      min={new Date().toISOString().slice(0, 16)}
                      value={customExpireTime}
                      onChange={(e) => setCustomExpireTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            )}

            {shareToken && (
              <div className="space-y-4">
                <div className="space-y-3.5">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Liên kết chia sẻ lịch biểu</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getShareUrl()}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/50 dark:text-white font-mono select-all"
                    />
                    <button
                      onClick={handleCopyUrl}
                      className="rounded-xl bg-blue-50 hover:bg-blue-100 px-4 text-xs font-bold text-blue-600 transition dark:bg-blue-950/40 dark:text-blue-400"
                    >
                      {copied ? 'Đã sao chép!' : 'Sao chép'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-amber-50/50 p-4 border border-amber-100/50 dark:bg-amber-950/10 dark:border-amber-900/20 text-xs text-amber-750 dark:text-amber-400 space-y-1">
                  <p className="font-extrabold uppercase tracking-wide text-[10px] text-amber-600 dark:text-amber-500">Thông tin thời hạn</p>
                  <p className="font-semibold">
                    {shareExpiresAt 
                      ? `Liên kết chia sẻ sẽ tự động hết hạn và tự tắt vào lúc: ${new Date(shareExpiresAt).toLocaleString('vi-VN')}`
                      : 'Liên kết chia sẻ này ở trạng thái vô thời hạn và chỉ kết thúc khi bạn tự tay gạt nút tắt.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* VÙNG PHẢI: QUẢN LÝ DANH MỤC */}
        <div className="space-y-8">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 backdrop-blur-md space-y-6">
            <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Tag size={18} className="text-blue-500" />
              Quản lý Danh mục (Categories)
            </h3>

            {catMessage && (
              <div className="rounded-xl bg-blue-50/50 p-3 text-xs font-bold text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/20">
                {catMessage}
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  placeholder="Tên danh mục mới (ví dụ: Thể thao)"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={catLoading}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/10 hover:bg-blue-700 transition"
                >
                  <Plus size={16} />
                  Thêm
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Màu sắc danh mục</label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCatColor(color)}
                      className="relative h-7 w-7 rounded-lg transition hover:scale-110 shadow-sm"
                      style={{ backgroundColor: color }}
                    >
                      {catColor === color && (
                        <span className="absolute inset-0 flex items-center justify-center text-white">
                          <Check size={14} className="font-bold" />
                        </span>
                      )}
                    </button>
                  ))}
                  {/* Custom Color Input */}
                  <input
                    type="color"
                    className="h-7 w-7 rounded-lg cursor-pointer border-none bg-transparent"
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                  />
                </div>
              </div>
            </form>

            {/* Categories List */}
            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Danh sách danh mục hiện có</label>
              <div className="flex flex-wrap gap-2.5">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: c.color }}
                  >
                    <span>{c.name}</span>
                    {c.userId && (
                      <span className="text-[9px] rounded bg-white/20 px-1 py-0.25 font-medium">Cá nhân</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CARD ĐỒNG BỘ LỊCH NGOÀI (iCALENDAR) */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 backdrop-blur-md space-y-6">
            <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Globe size={18} className="text-blue-500" />
              Đồng bộ lịch ngoài (iCalendar Feed)
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Bạn có thể đồng bộ hóa lịch trình trên Planify sang các ứng dụng lịch khác như **Google Calendar**, **Outlook**, hoặc **Apple Calendar** thông qua liên kết iCalendar feed. Lịch biểu sẽ được cập nhật tự động.
            </p>

            <div className="space-y-3.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Liên kết iCalendar Feed cá nhân</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getExportUrl()}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/50 dark:text-white font-mono select-all"
                />
                <button
                  onClick={() => {
                    const url = getExportUrl();
                    navigator.clipboard.writeText(url);
                    alert('Đã sao chép liên kết iCalendar Feed!');
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shrink-0"
                >
                  Sao chép
                </button>
              </div>

              {/* NÚT HỖ TRỢ ĐỒNG BỘ NHANH */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <a
                  href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
                    getExportUrl()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-2.5 text-[11px] font-bold text-white transition shadow-sm text-center"
                >
                  <Calendar size={13} className="shrink-0" />
                  Đồng bộ Google Calendar
                </a>
                <a
                  href={getWebcalUrl()}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 px-3 py-2.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 transition shadow-sm border border-blue-100/50 dark:border-blue-900/30 text-center"
                >
                  <Calendar size={13} className="shrink-0" />
                  Đăng ký Webcal
                </a>
                <a
                  href={getExportUrl()}
                  download={`planify-calendar-${user?.username}.ics`}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition shadow-sm border border-slate-200/50 dark:border-slate-850 text-center"
                >
                  <Calendar size={13} className="shrink-0" />
                  Tải tệp .ics (Localhost)
                </a>
              </div>
            </div>
            
            <div className="rounded-2xl bg-blue-50/30 dark:bg-slate-950/20 border border-blue-100/50 dark:border-slate-800/40 p-4 space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="font-extrabold text-slate-700 dark:text-slate-300">💡 Cách đồng bộ lịch Google Calendar:</div>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Sao chép liên kết iCalendar Feed ở trên.</li>
                <li>Mở Google Calendar trên máy tính.</li>
                <li>Ở cột trái, nhấn nút dấu <span className="font-bold">+</span> cạnh mục <span className="font-bold">Lịch khác</span>.</li>
                <li>Chọn <span className="font-bold">Từ URL</span> và dán liên kết vừa sao chép vào.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
