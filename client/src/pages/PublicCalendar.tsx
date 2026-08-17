import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import api from '../services/api';
import { Calendar as CalendarIcon, MapPin, AlignLeft, X, AlertTriangle } from 'lucide-react';

interface PublicEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  color: string;
  categoryName?: string;
}

const PublicCalendar: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [ownerName, setOwnerName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal xem chi tiết sự kiện
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const fetchPublicData = async () => {
      if (!shareToken) return;
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/public/calendar/${shareToken}`);
        setEvents(res.data.events);
        setOwnerName(res.data.user.username);
      } catch (err: any) {
        console.error('Lỗi lấy lịch biểu công khai:', err);
        setError(
          err.response?.status === 404
            ? 'Liên kết lịch biểu công khai không tồn tại hoặc đã bị tắt chia sẻ.'
            : 'Đã xảy ra lỗi khi kết nối dữ liệu lịch biểu.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPublicData();
  }, [shareToken]);

  const mapEventsToCalendar = () => {
    return events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.startTime,
      end: e.endTime,
      backgroundColor: e.color || '#3b82f6',
      borderColor: e.color || '#3b82f6',
      textColor: '#ffffff',
      extendedProps: {
        description: e.description,
        location: e.location,
        categoryName: e.categoryName,
      },
    }));
  };

  const handleEventClick = (clickInfo: any) => {
    const eventId = clickInfo.event.id;
    const clicked = events.find((e) => e.id === eventId);
    if (clicked) {
      setSelectedEvent(clicked);
      setModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 dark:bg-[#05070c]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Đang tải lịch trình công khai...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-[#05070c]">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-500">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-lg font-black text-slate-800 dark:text-white">Không tìm thấy lịch biểu</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 dark:bg-[#05070c] text-slate-900 dark:text-white">
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200/50 pb-5 dark:border-slate-800/50 gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <CalendarIcon size={24} className="text-blue-500" />
              Lịch biểu công khai của {ownerName}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trang xem lịch trình công khai, cập nhật thời gian thực.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100/30 px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 select-none">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            Đang hoạt động (Chỉ xem)
          </div>
        </div>

        {/* Calendar Box */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 backdrop-blur-md">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            locale="vi"
            firstDay={1}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }}
            editable={false}
            selectable={false}
            events={mapEventsToCalendar()}
            eventClick={handleEventClick}
            allDaySlot={false}
            contentHeight="auto"
          />
        </div>
      </div>

      {/* View Event Detail Modal */}
      {modalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                <CalendarIcon size={18} className="text-blue-500" />
                Chi tiết sự kiện
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="space-y-1">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Tiêu đề sự kiện</span>
                <p className="text-sm font-black text-slate-900 dark:text-white leading-snug">{selectedEvent.title}</p>
              </div>

              {selectedEvent.categoryName && (
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Danh mục</span>
                  <span
                    className="inline-flex rounded-lg px-2.5 py-0.5 text-[9px] text-white font-extrabold shadow-sm"
                    style={{ backgroundColor: selectedEvent.color }}
                  >
                    {selectedEvent.categoryName}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Bắt đầu</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {new Date(selectedEvent.startTime).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Kết thúc</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {new Date(selectedEvent.endTime).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>

              {selectedEvent.location && (
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                    <MapPin size={12} /> Địa điểm
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                    {selectedEvent.location}
                  </p>
                </div>
              )}

              {selectedEvent.description && (
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                    <AlignLeft size={12} /> Mô tả chi tiết
                  </span>
                  <p className="font-medium text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {selectedEvent.description}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/10 hover:bg-blue-700 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicCalendar;
