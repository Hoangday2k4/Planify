import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import UserAvatar from './UserAvatar';
import CommandMenu from './CommandMenu';
import DOMPurify from 'dompurify';
import {
  Calendar as CalendarIcon,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  Bell,
  Sun,
  Moon,
  Search,
  Menu,
  X,
  ChevronDown,
  User as UserIcon,
  Lock
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lắng nghe tổ hợp phím Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Quản lý theme (Dark/Light mode)
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Lấy thông báo từ backend
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Không thể lấy thông báo:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);

    if (socket && user) {
      socket.emit('join_user', user.id);

      const handleNewNotification = (notif: any) => {
        setNotifications(prev => [notif, ...prev]);
      };

      socket.on('new_notification', handleNewNotification);

      return () => {
        clearInterval(interval);
        socket.emit('leave_user', user.id);
        socket.off('new_notification', handleNewNotification);
      };
    }

    return () => clearInterval(interval);
  }, [user, socket]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Lỗi khi đánh dấu thông báo đã đọc:', err);
    }
  };

  const handleClearReadNotifications = async () => {
    try {
      await api.delete('/notifications/read');
      setNotifications(prev => prev.filter(n => !n.isRead));
    } catch (err) {
      console.error('Lỗi khi xóa thông báo đã đọc:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const menuItems = [
    { name: 'Bảng điều khiển', path: '/', icon: LayoutDashboard },
    { name: 'Lịch biểu', path: '/calendar', icon: CalendarIcon },
    { name: 'Công việc', path: '/tasks', icon: CheckSquare },
  ];

  const formatNotificationContent = (content: string) => {
    const clean = content
      .replace(/\[EMAIL_ONLY\]/g, '')
      .replace(/\[Event ID:\s*[a-zA-Z0-9-]+\]/g, '')
      .replace(/\(ID:\s*[a-zA-Z0-9-]+\)/g, '')
      .trim();
    
    const sanitized = DOMPurify.sanitize(clean);
    return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-200">
      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed bottom-4 top-4 left-4 z-50 flex w-64 flex-col rounded-3xl border border-slate-200/50 bg-white/75 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.02)] transition-transform duration-300 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/75 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} h-[calc(100vh-2rem)]`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
              <CalendarIcon size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Planify</span>
          </div>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'}`}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer in Sidebar */}
        <div className="border-t border-slate-200/80 pt-4 dark:border-slate-800/80">
          <div className="flex items-center gap-3 px-2 py-1">
             <UserAvatar 
               username={user?.username} 
               avatarUrl={user?.avatar} 
               sizeClass="h-10 w-10" 
               textClass="text-sm font-black"
             />
            <div className="flex-1 overflow-hidden">
              <h4 className="truncate text-sm font-bold text-slate-800 dark:text-slate-200">{user?.username}</h4>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 flex w-full items-center gap-3.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 transition"
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex flex-1 flex-col lg:pl-[18.5rem]">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/40 bg-white/40 px-6 backdrop-blur-md dark:border-slate-800/40 dark:bg-[#05070c]/40">
          <div className="flex items-center gap-4">
            <button
              className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>

            {/* Search (Dành cho việc nâng cao) */}
            <div className="relative hidden max-w-xs md:block cursor-pointer animate-fade-in" onClick={() => setSearchOpen(true)}>
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-450 dark:text-slate-500">
                <Search size={16} />
              </span>
              <div className="w-60 rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-4 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-950/50 flex items-center justify-between select-none">
                <span>Tìm kiếm nhanh...</span>
                <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Ctrl+K</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="rounded-xl border border-slate-200/80 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification Center */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className="relative rounded-xl border border-slate-200/80 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notifDropdownOpen && (
                <div className="absolute right-0 mt-2 z-50 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-850 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3 dark:border-slate-800">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">Thông báo</h4>
                    <div className="flex items-center gap-2">
                      {notifications.some(n => n.isRead) && (
                        <button
                          onClick={handleClearReadNotifications}
                          className="text-[10px] font-black text-red-650 hover:text-red-500 dark:text-red-400 dark:hover:text-red-350 hover:underline transition"
                        >
                          Xóa đã xem
                        </button>
                      )}
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                        {unreadCount} mới
                      </span>
                    </div>
                  </div>

                    <div className="max-h-60 overflow-y-auto space-y-2.5">
                      {notifications.length === 0 ? (
                        <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">Không có thông báo mới</p>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => {
                              if (!notif.isRead) handleMarkAsRead(notif.id);
                              
                              // Check Event ID
                              const eventMatch = notif.content.match(/\[Event ID:\s*([a-zA-Z0-9-]+)\]/);
                              if (eventMatch && eventMatch[1]) {
                                navigate('/calendar', { state: { openEventId: eventMatch[1] } });
                                setNotifDropdownOpen(false);
                                return;
                              }

                              // Check Task ID
                              const taskMatch = notif.content.match(/\(ID:\s*([a-zA-Z0-9-]+)\)/);
                              if (taskMatch && taskMatch[1]) {
                                navigate('/tasks', { state: { openTaskId: taskMatch[1] } });
                                setNotifDropdownOpen(false);
                                return;
                              }
                            }}
                            className={`group cursor-pointer rounded-xl p-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40 ${notif.isRead ? 'opacity-60' : 'bg-blue-50/30 border border-blue-100/50 dark:bg-blue-950/10 dark:border-blue-900/20'}`}
                          >
                            <h5 className="font-bold text-xs text-slate-800 dark:text-white flex items-center justify-between">
                              {notif.title}
                              {!notif.isRead && (
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              )}
                            </h5>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{formatNotificationContent(notif.content)}</p>
                            <span className="mt-1.5 block text-[10px] text-slate-400">
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                              {new Date(notif.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
              )}
            </div>

            {/* Profile Dropdown Header */}
            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 hover:opacity-85 transition"
              >
                <UserAvatar 
                  username={user?.username} 
                  avatarUrl={user?.avatar} 
                  sizeClass="h-8 w-8" 
                  textClass="text-xs font-black"
                />
                <ChevronDown size={14} className="text-slate-500" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 z-50 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-805 dark:bg-slate-900">
                    <Link
                      to="/settings"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <UserIcon size={16} />
                      <span>Thông tin cá nhân</span>
                    </Link>
                    <Link
                      to="/change-password"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Lock size={16} className="text-violet-500" />
                      <span>Đổi mật khẩu</span>
                    </Link>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 text-left font-semibold"
                    >
                      <LogOut size={16} />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Pages */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <CommandMenu isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

export default Layout;
