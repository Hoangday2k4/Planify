import React from 'react';

interface UserAvatarProps {
  username?: string;
  avatarUrl?: string;
  sizeClass?: string; // ví dụ: "h-10 w-10" hoặc "h-20 w-20"
  textClass?: string; // ví dụ: "text-sm font-bold" hoặc "text-2xl font-black"
}

const UserAvatar: React.FC<UserAvatarProps> = ({ 
  username = 'User', 
  avatarUrl, 
  sizeClass = 'h-10 w-10',
  textClass = 'text-sm font-bold'
}) => {
  // Hàm lấy màu sắc ngẫu nhiên cố định dựa trên tên người dùng
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600 text-white shadow-lg shadow-blue-500/20',
      'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20',
      'bg-violet-600 text-white shadow-lg shadow-violet-500/20',
      'bg-purple-600 text-white shadow-lg shadow-purple-500/20',
      'bg-pink-600 text-white shadow-lg shadow-pink-500/20',
      'bg-rose-600 text-white shadow-lg shadow-rose-500/20',
      'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20',
      'bg-teal-600 text-white shadow-lg shadow-teal-500/20',
      'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
    ];
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  // Xác định xem avatar có trống hoặc là ảnh mặc định Unsplash ban đầu không
  const isDefaultOrEmpty = !avatarUrl || 
    avatarUrl.includes('photo-1535713875002-d1d0cf377fde') ||
    avatarUrl.trim() === '';

  if (isDefaultOrEmpty) {
    const firstLetter = username.charAt(0).toUpperCase();
    const colorClass = getAvatarColor(username);
    return (
      <div className={`flex items-center justify-center rounded-xl select-none shrink-0 ${sizeClass} ${colorClass}`}>
        <span className={textClass}>{firstLetter}</span>
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={username}
      className={`rounded-xl object-cover shrink-0 ring-2 ring-slate-100/50 dark:ring-slate-800/50 ${sizeClass}`}
    />
  );
};

export default UserAvatar;
