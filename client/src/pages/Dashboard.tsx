import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  Calendar as CalendarIcon, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Folder,
  ChevronRight,
  Award
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

interface Event {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  priority: string;
  color: string;
  category?: { name: string; color: string };
}

interface Task {
  id: string;
  title: string;
  deadline?: string;
  priority: string;
  status: string;
  progress: number;
  category?: { name: string; color: string };
  subtasks: { id: string; title: string; isCompleted: boolean }[];
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [weekEvents, setWeekEvents] = useState<Event[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const today = new Date();
        const startOfDay = new Date(new Date(today).setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(new Date(today).setHours(23, 59, 59, 999)).toISOString();

        // 1. Lấy sự kiện hôm nay
        const eventsRes = await api.get(`/events?start=${startOfDay}&end=${endOfDay}`);
        setTodayEvents(eventsRes.data);

        // 2. Lấy sự kiện cả tuần này
        const startOfWeek = new Date();
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Đưa về thứ 2
        const startOfWeekDate = new Date(startOfWeek.setDate(diff));
        startOfWeekDate.setHours(0, 0, 0, 0);

        const endOfWeekDate = new Date(startOfWeekDate);
        endOfWeekDate.setDate(endOfWeekDate.getDate() + 6);
        endOfWeekDate.setHours(23, 59, 59, 999);

        const weekEventsRes = await api.get(`/events?start=${startOfWeekDate.toISOString()}&end=${endOfWeekDate.toISOString()}`);
        setWeekEvents(weekEventsRes.data);

        // 3. Lấy toàn bộ tasks
        const tasksRes = await api.get('/tasks');
        setAllTasks(tasksRes.data);
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const completedTasksCount = allTasks.filter(t => t.status === 'COMPLETED').length;
  const totalTasksCount = allTasks.length;
  const overallProgress = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Điểm năng suất & Huy hiệu
  const getProductivityBadge = () => {
    if (completedTasksCount >= 10 && overallProgress >= 80) {
      return { title: 'Chiến binh năng suất 🎖️', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 border-amber-200' };
    }
    if (completedTasksCount >= 5) {
      return { title: 'Nhà hoạch định tài ba 🎯', color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20 border-blue-200' };
    }
    return { title: 'Người khởi đầu đầy năng lượng 🌱', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200' };
  };

  const badge = getProductivityBadge();

  // Dữ liệu cho PieChart (Thống kê công việc theo Category)
  const getCategoryChartData = () => {
    const catMap: Record<string, { name: string; value: number; color: string }> = {};
    allTasks.forEach(task => {
      const catName = task.category?.name || 'Chưa phân loại';
      const catColor = task.category?.color || '#cbd5e1';
      if (!catMap[catName]) {
        catMap[catName] = { name: catName, value: 0, color: catColor };
      }
      catMap[catName].value += 1;
    });
    return Object.values(catMap);
  };

  const categoryData = getCategoryChartData();

  // Dữ liệu cho BarChart (Tổng số giờ sự kiện mỗi ngày trong tuần này)
  const getWeekChartData = () => {
    const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    const hoursPerDay = [0, 0, 0, 0, 0, 0, 0];

    weekEvents.forEach(event => {
      const eventDate = new Date(event.startTime);
      let dayIndex = eventDate.getDay() - 1; // 0 = Thứ Hai, ..., 5 = Thứ Bảy
      if (dayIndex === -1) dayIndex = 6; // Chủ Nhật

      if (dayIndex >= 0 && dayIndex < 7) {
        const durationHrs = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
        hoursPerDay[dayIndex] += Math.round(durationHrs * 10) / 10;
      }
    });

    return days.map((dayName, idx) => ({
      name: dayName,
      'Số giờ': hoursPerDay[idx]
    }));
  };

  const weekChartData = getWeekChartData();

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="relative space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-8 text-white shadow-[0_15px_30px_-5px_rgba(37,99,235,0.2)] dark:from-blue-700 dark:via-indigo-800 dark:to-violet-850">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-xl"></div>
        <div className="absolute -right-20 -bottom-20 h-48 w-48 rounded-full bg-white/10 blur-2xl"></div>
        
        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold tracking-wider uppercase backdrop-blur-sm">Workspace</span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-extrabold backdrop-blur-md ${badge.color}`}>
              <Award size={14} />
              {badge.title}
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Xin chào, {user?.username} 👋</h1>
          <p className="max-w-2xl text-blue-100 text-sm font-semibold leading-relaxed">
            {todayEvents.length > 0 
              ? `Hôm nay bạn có ${todayEvents.length} sự kiện đang chờ đợi. Hãy hoàn thành tốt lịch trình nhé!` 
              : 'Hôm nay bạn chưa có sự kiện nào. Hãy bắt đầu lên kế hoạch ngay thôi!'}
          </p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="glass-card hover-lift flex items-center gap-5 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50/50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
            <CalendarIcon size={26} />
          </div>
          <div className="space-y-1">
            <span className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Sự kiện hôm nay</span>
            <span className="text-3xl font-black text-slate-900 dark:text-white">{todayEvents.length}</span>
          </div>
        </div>

        <div className="glass-card hover-lift flex items-center gap-5 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50/50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <CheckCircle size={26} />
          </div>
          <div className="space-y-1">
            <span className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Công việc hoàn thành</span>
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {completedTasksCount}<span className="text-sm font-bold text-slate-400 dark:text-slate-500">/{totalTasksCount}</span>
            </span>
          </div>
        </div>

        <div className="glass-card hover-lift flex items-center gap-5 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50/50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400">
            <TrendingUp size={26} />
          </div>
          <div className="space-y-1">
            <span className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Hiệu suất tổng quát</span>
            <span className="text-3xl font-black text-slate-900 dark:text-white">{overallProgress}%</span>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie Chart: Công việc theo Danh mục */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
            Tỷ lệ Công việc theo Danh mục
          </h3>
          <div className="h-64">
            {categoryData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">
                Chưa có công việc nào để phân tích.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
                    }} 
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar Chart: Tổng số giờ sự kiện trong tuần */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
            Thời lượng Lịch trình Tuần này (Số giờ)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekChartData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(59, 130, 246, 0.04)' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
                  }} 
                />
                <Bar dataKey="Số giờ" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Today's Events Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Clock size={20} className="text-blue-500" />
              Lịch trình hôm nay
            </h3>
            <Link to="/calendar" className="text-xs font-extrabold text-blue-600 hover:text-blue-500 dark:text-blue-400 flex items-center gap-0.5">
              Xem lịch biểu <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-4">
            {todayEvents.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800 bg-white/40 dark:bg-slate-900/10 backdrop-blur-sm">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Không có sự kiện nào được lên lịch cho ngày hôm nay.</p>
                <Link to="/calendar" className="mt-4 inline-block rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition">
                  Tạo sự kiện ngay
                </Link>
              </div>
            ) : (
              todayEvents.map((event) => (
                <div 
                  key={event.id}
                  onClick={() => navigate('/calendar', { state: { openEventId: event.id } })}
                  className="glass-card hover-lift flex items-center justify-between p-5 cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50/50 px-3.5 py-2.5 text-slate-700 border border-slate-100 dark:bg-slate-850/40 dark:text-slate-300 dark:border-slate-800/50">
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                        {formatTime(event.startTime)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        đến {formatTime(event.endTime)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">
                        {event.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {event.description || 'Không có mô tả chi tiết'}
                      </p>
                      {event.location && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          📍 {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <span 
                    className="h-3 w-3 rounded-full shadow-sm" 
                    style={{ backgroundColor: event.color }} 
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Deadlines & Progress Sidebar Column */}
        <div className="space-y-6">
          {/* Deadlines */}
          <div className="space-y-4">
            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <AlertCircle size={20} className="text-red-500" />
              Công việc khẩn (Deadlines)
            </h3>
            <div className="space-y-4">
              {allTasks.filter(t => t.status !== 'COMPLETED' && t.deadline).slice(0, 3).length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800 bg-white/20">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Không có công việc nào sắp đến hạn chót.</p>
                </div>
              ) : (
                allTasks
                  .filter(t => t.status !== 'COMPLETED' && t.deadline)
                  .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
                  .slice(0, 3)
                  .map((task) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const deadlineDate = new Date(task.deadline!);
                    deadlineDate.setHours(0, 0, 0, 0);
                    const diffDays = Math.round((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const isUrgent = diffDays <= 1;
                    return (
                      <div 
                        key={task.id}
                        onClick={() => navigate('/tasks', { state: { openTaskId: task.id } })}
                        className={`glass-card p-5 border-l-4 cursor-pointer hover-lift ${isUrgent ? 'border-l-red-500 bg-red-50/5 dark:bg-red-950/5' : 'border-l-amber-500 bg-amber-50/5 dark:bg-amber-950/5'}`}
                      >
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-white leading-snug">{task.title}</h4>
                        <div className="mt-3 flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-500 dark:text-slate-300">
                            Hạn: {new Date(task.deadline!).toLocaleDateString()}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${isUrgent ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'}`}>
                            {diffDays < 0 ? 'Quá hạn!' : diffDays === 0 ? 'Hôm nay!' : `Còn ${diffDays} ngày`}
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Project Progress */}
          <div className="space-y-4">
            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Folder size={20} className="text-violet-500" />
              Tiến độ dự án
            </h3>
            <div className="glass-card p-6 space-y-5">
              {allTasks.filter(t => t.subtasks.length > 0 && t.status === 'IN_PROGRESS').slice(0, 4).length === 0 ? (
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 py-2 text-center">
                  Không có dự án nào đang thực hiện.
                </p>
              ) : (
                allTasks
                  .filter(t => t.subtasks.length > 0 && t.status === 'IN_PROGRESS')
                  .slice(0, 4)
                  .map((task) => (
                    <div 
                      key={task.id} 
                      className="space-y-2 cursor-pointer hover:opacity-85"
                      onClick={() => navigate('/tasks', { state: { openTaskId: task.id } })}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[70%]">
                          {task.title}
                        </span>
                        <span className="font-extrabold text-blue-600 dark:text-blue-300">{task.progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 transition-all duration-500" 
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
