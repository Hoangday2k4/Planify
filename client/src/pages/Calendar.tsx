import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import api from '../services/api';
import { 
  Calendar as CalendarIcon, 
  MapPin, 
  AlignLeft, 
  Trash2, 
  X, 
  Plus, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { downloadEventTemplate, parseExcelFile } from '../services/excelService';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  priority: string;
  categoryId?: string;
  color: string;
  status: string;
  repeatRule?: string;
  tags?: Array<{ id: string; name: string; color: string }>;
  reminders?: { id: string; minutesBefore: number; type: string }[];
}



// Chuyển đối tượng Date thành chuỗi local Date 'YYYY-MM-DD'
const formatToLocalDate = (date: Date) => {
  if (!date || isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
};

// Lấy giờ và phút ở múi giờ local dạng chuỗi 'HH:mm'
const getHourMinuteString = (date: Date) => {
  if (!date || isNaN(date.getTime())) return '00:00';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};



// Lấy mốc thời gian 4 tiếng theo index (0 đến 5)
const getSlotRange = (index: number) => {
  const minHour = index * 4;
  const maxHour = minHour + 4;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    min: `${pad(minHour)}:00:00`,
    max: `${pad(maxHour === 24 ? 24 : maxHour)}:00:00`,
    label: `${pad(minHour)}:00 - ${pad(maxHour === 24 ? 24 : maxHour)}:00`
  };
};

// Tùy biến nội dung hiển thị của sự kiện trên lịch biểu
const renderEventContent = (eventInfo: any) => {
  const { event, view } = eventInfo;
  const { description, location } = event.extendedProps;

  // Tính thời lượng của sự kiện theo phút
  const durationMs = event.end ? (event.end.getTime() - event.start.getTime()) : 0;
  const durationMins = durationMs / (1000 * 60);

  // View Tháng: Hiển thị tối giản inline dot
  if (view.type === 'dayGridMonth') {
    return (
      <div className="flex items-center gap-1 truncate px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: event.backgroundColor }} />
        <span className="opacity-75 font-bold shrink-0">{eventInfo.timeText}</span>
        <span className="truncate">{event.title}</span>
      </div>
    );
  }

  // View Tuần: Chỉ hiển thị Giờ và Tiêu đề gọn gàng
  if (view.type === 'timeGridWeek') {
    // Nếu sự kiện quá ngắn (dưới 10 phút), ẩn chữ hoàn toàn để tránh tràn và đè chữ
    if (durationMins > 0 && durationMins <= 10) {
      return <div className="h-full w-full" />;
    }
    return (
      <div className="p-1 h-full flex flex-col justify-center overflow-hidden text-white select-none">
        <div className="text-[9px] font-bold opacity-90 leading-tight">
          {eventInfo.timeText}
        </div>
        <div className="text-[10px] font-black leading-tight truncate">
          {event.title}
        </div>
      </div>
    );
  }

  // View Ngày: hiển thị chi tiết đầy đủ với chữ nhỏ gọn gàng
  // Nếu sự kiện quá ngắn (dưới 10 phút), ẩn chữ hoàn toàn để tránh tràn chữ và đè lên nhau
  if (durationMins > 0 && durationMins <= 10) {
    return <div className="h-full w-full" />;
  }

  const isShortEvent = durationMins > 0 && durationMins <= 30;

  return (
    <div className="p-2 h-full flex flex-col justify-between overflow-hidden text-white select-none">
      <div className="space-y-1">
        <div className="text-[10px] font-black leading-snug truncate">
          {eventInfo.timeText} - {event.title}
        </div>
        {!isShortEvent && description && (
          <p className="text-[10px] opacity-90 leading-relaxed line-clamp-3 italic font-medium bg-black/15 rounded-lg px-2 py-1 mt-1 whitespace-pre-wrap break-words">
            {description}
          </p>
        )}
      </div>
      {!isShortEvent && location && (
        <div className="text-[9px] opacity-95 font-black flex items-center gap-1 mt-1 border-t border-white/20 pt-1 truncate">
          <span>📍</span>
          <span className="truncate">{location}</span>
        </div>
      )}
    </div>
  );
};

const Calendar: React.FC = () => {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('dayGridMonth');
  const [timeSlotIndex, setTimeSlotIndex] = useState(() => Math.floor(new Date().getHours() / 4));
  const activeSlot = getSlotRange(timeSlotIndex);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>(580);
  const [events, setEvents] = useState<Event[]>([]);
  const calendarIntervalRef = useRef<{ start: Date; end: Date } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [repeatRule, setRepeatRule] = useState('NONE');

  // Filter States
  const [filterCategoryId, setFilterCategoryId] = useState('ALL');
  const [filterTagId, setFilterTagId] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Excel Import States
  const [importExcelOpen, setImportExcelOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedEvents, setParsedEvents] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; conflicts: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setImportError(null);
    setImportResult(null);

    try {
      const data = await parseExcelFile(file);
      setParsedEvents(data);
    } catch (err) {
      console.error('Lỗi đọc file Excel:', err);
      setImportError('Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file mẫu.');
    }
  };

  const handleImportExcel = async () => {
    if (parsedEvents.length === 0) return;

    setImportLoading(true);
    setImportError(null);
    let successCount = 0;
    let failedCount = 0;
    let conflictsCount = 0;

    let currentCats = [...categories];
    let currentTags = [...availableTags];

    for (const item of parsedEvents) {
      const eventTitle = item['Tên sự kiện'];
      const eventStart = item['Thời gian bắt đầu (YYYY-MM-DD HH:MM)'];
      const eventEnd = item['Thời gian kết thúc (YYYY-MM-DD HH:MM)'];
      const location = item['Địa điểm'];
      const categoryName = item['Danh mục'];
      const priorityRaw = item['Mức ưu tiên (LOW/MEDIUM/HIGH)'];
      const hasReminderRaw = item['Bật nhắc nhở (Có/Không)'];
      const repeatRaw = item['Lặp lại (Không lặp lại/Mỗi ngày/Mỗi tuần/Mỗi tháng)'];
      const description = item['Mô tả'];

      // Bắt buộc các trường ngoại trừ nhãn dán (Tags) phải có nội dung
      if (!eventTitle || !eventStart || !eventEnd || !location || !categoryName || !priorityRaw || !hasReminderRaw || !repeatRaw || !description) {
        failedCount++;
        continue;
      }

      // Xử lý nhắc nhở (Reminders)
      const isReminderEnabled = hasReminderRaw.toString().trim().toLowerCase() === 'có' || hasReminderRaw.toString().trim().toLowerCase() === 'yes';
      let reminders: any[] = [];
      if (isReminderEnabled) {
        const reminderMinutesRaw = item['Thời gian nhắc nhở (phút trước)'];
        const reminderTypeRaw = item['Phương thức nhắc nhở (Web/Mail/Cả hai)'];

        if (reminderMinutesRaw === undefined || reminderMinutesRaw === null || reminderMinutesRaw === '' || !reminderTypeRaw) {
          failedCount++; // Bắt buộc điền thông tin nhắc nhở nếu chọn "Có"
          continue;
        }

        const mins = parseInt(reminderMinutesRaw.toString().trim(), 10);
        if (isNaN(mins)) {
          failedCount++;
          continue;
        }

        const typeStr = reminderTypeRaw.toString().trim().toLowerCase();
        if (typeStr === 'web' || typeStr === 'notification') {
          reminders.push({ minutesBefore: mins, type: 'NOTIFICATION' });
        } else if (typeStr === 'mail' || typeStr === 'email') {
          reminders.push({ minutesBefore: mins, type: 'EMAIL' });
        } else if (typeStr === 'cả hai' || typeStr === 'both') {
          reminders.push({ minutesBefore: mins, type: 'NOTIFICATION' });
          reminders.push({ minutesBefore: mins, type: 'EMAIL' });
        } else {
          failedCount++; // Phương thức nhắc nhở không đúng
          continue;
        }
      }

      // Xử lý Lặp lại lịch trình (4 giá trị)
      let repeatRule = 'NONE';
      const repStr = repeatRaw.toString().trim().toLowerCase();
      if (repStr === 'không lặp lại' || repStr === 'none') repeatRule = 'NONE';
      else if (repStr === 'mỗi ngày' || repStr === 'daily') repeatRule = 'DAILY';
      else if (repStr === 'mỗi tuần' || repStr === 'weekly') repeatRule = 'WEEKLY';
      else if (repStr === 'mỗi tháng' || repStr === 'monthly') repeatRule = 'MONTHLY';
      else {
        failedCount++; // Không khớp 4 giá trị lặp
        continue;
      }

      // Xử lý ngày tháng
      const startDateVal = new Date(eventStart);
      const endDateVal = new Date(eventEnd);
      if (isNaN(startDateVal.getTime()) || isNaN(endDateVal.getTime()) || startDateVal >= endDateVal) {
        failedCount++;
        continue;
      }

      // Xử lý danh mục: khớp tên hoặc tự động tạo mới
      let categoryId = '';
      const matchedCat = currentCats.find(c => c.name.toLowerCase() === categoryName.toString().trim().toLowerCase());
      if (matchedCat) {
        categoryId = matchedCat.id;
      } else {
        try {
          const presetColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];
          const randomColor = presetColors[Math.floor(Math.random() * presetColors.length)];
          const newCatRes = await api.post('/categories', { name: categoryName.toString().trim(), color: randomColor });
          categoryId = newCatRes.data.id;
          currentCats.push(newCatRes.data);
        } catch (err) {
          failedCount++;
          continue;
        }
      }

      // Xử lý mức ưu tiên
      let priority = 'MEDIUM';
      const prioStr = priorityRaw.toString().trim().toUpperCase();
      if (prioStr === 'LOW' || prioStr === 'THẤP') priority = 'LOW';
      else if (prioStr === 'HIGH' || prioStr === 'CAO') priority = 'HIGH';
      else if (prioStr === 'MEDIUM' || prioStr === 'TRUNG BÌNH') priority = 'MEDIUM';

      // Xử lý nhãn dán (Tags) - Có thể để trống
      const tagsRaw = item['Nhãn dán (Tags)'];
      const tagIds: string[] = [];
      if (tagsRaw) {
        const tagNames = tagsRaw.toString().split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
        for (const tagName of tagNames) {
          let matchedTag = currentTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
          if (matchedTag) {
            tagIds.push(matchedTag.id);
          } else {
            try {
              const newTagRes = await api.post('/tags', { name: tagName, color: '#3b82f6' });
              tagIds.push(newTagRes.data.id);
              currentTags.push(newTagRes.data);
            } catch (err) {
              console.error('Không thể tạo nhãn dán mới trong lúc import:', err);
            }
          }
        }
      }

      try {
        await api.post('/events', {
          title: eventTitle.toString().trim(),
          description: description.toString().trim(),
          startTime: startDateVal.toISOString(),
          endTime: endDateVal.toISOString(),
          location: location.toString().trim(),
          priority,
          categoryId,
          repeatRule,
          reminders,
          tagIds
        });
        successCount++;
      } catch (err: any) {
        console.error('Lỗi import event:', err);
        if (err.response?.status === 409) {
          conflictsCount++;
        } else {
          failedCount++;
        }
      }
    }

    setImportResult({ success: successCount, failed: failedCount, conflicts: conflictsCount });
    setImportLoading(false);
    fetchData();
  };

  const resetImportState = () => {
    setExcelFile(null);
    setParsedEvents([]);
    setImportResult(null);
    setImportError(null);
  };

  // Form State
  const [eventId, setEventId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTimeText, setStartTimeText] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTimeText, setEndTimeText] = useState('00:00');


  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [categoryId, setCategoryId] = useState('');
  const [eventColor, setEventColor] = useState('#3b82f6');
  const [status, setStatus] = useState('CONFIRMED');
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState('15');
  const [reminderType, setReminderType] = useState('NOTIFICATION');

  const calendarRef = useRef<FullCalendar>(null);

  // Tooltip States cho việc di chuột hiển thị thông tin
  const [hoveredEvent, setHoveredEvent] = useState<any | null>(null);
  const [tooltipCoords, setTooltipCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverTimerRef = useRef<any>(null);

  const handleEventMouseEnter = (info: any) => {
    const { event, jsEvent } = info;
    const { description, location } = event.extendedProps;
    
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    
    const x = jsEvent.clientX;
    const y = jsEvent.clientY;
    
    // Đợi 1 giây di chuột đứng yên thì hiện thông tin lên
    hoverTimerRef.current = setTimeout(() => {
      setTooltipCoords({ x, y });
      setHoveredEvent({
        title: event.title,
        start: event.start,
        end: event.end,
        description,
        location,
        backgroundColor: event.backgroundColor
      });
    }, 1000);
  };

  const handleEventMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredEvent(null);
  };

  const fetchEventsForInterval = async (start: Date, end: Date) => {
    try {
      const res = await api.get(`/events?start=${start.toISOString()}&end=${end.toISOString()}`);
      setEvents(res.data);
    } catch (err) {
      console.error('Lỗi lấy sự kiện theo khoảng:', err);
    }
  };

  // Fetch all events, categories and tags
  const fetchData = async () => {
    try {
      setLoading(true);
      const [catsRes, tagsRes] = await Promise.all([
        api.get('/categories'),
        api.get('/tags')
      ]);
      setCategories(catsRes.data);
      setAvailableTags(tagsRes.data);

      if (calendarIntervalRef.current) {
        await fetchEventsForInterval(calendarIntervalRef.current.start, calendarIntervalRef.current.end);
      }
    } catch (err) {
      console.error('Không thể lấy dữ liệu danh mục hoặc nhãn dán:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDatesSet = async (dateInfo: any) => {
    setCurrentView(dateInfo.view.type);
    if (dateInfo.view.type === 'dayGridMonth') {
      setContentHeight(580);
    } else {
      setContentHeight('auto');
    }
    calendarIntervalRef.current = { start: dateInfo.start, end: dateInfo.end };
    await fetchEventsForInterval(dateInfo.start, dateInfo.end);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tự động mở modal sự kiện nếu nhận được event ID từ trang khác chuyển sang
  useEffect(() => {
    if (events.length > 0 && routerLocation.state?.openEventId) {
      const targetEventId = routerLocation.state.openEventId;
      const clickedEvent = events.find(e => e.id === targetEventId);
      if (clickedEvent) {
        setIsEditing(true);
        setEventId(clickedEvent.id);
        setTitle(clickedEvent.title);
        setDescription(clickedEvent.description || '');
        setStartDate(formatToLocalDate(new Date(clickedEvent.startTime)));
        setStartTimeText(getHourMinuteString(new Date(clickedEvent.startTime)));
        setEndDate(formatToLocalDate(new Date(clickedEvent.endTime)));
        setEndTimeText(getHourMinuteString(new Date(clickedEvent.endTime)));
        setLocation(clickedEvent.location || '');
        setPriority(clickedEvent.priority);
        setCategoryId(clickedEvent.categoryId || '');
        setEventColor(clickedEvent.color);
        setStatus(clickedEvent.status);
        setRepeatRule(clickedEvent.repeatRule || 'NONE');
        setSelectedTagIds(clickedEvent.tags ? clickedEvent.tags.map((t: any) => t.id) : []);
        
        const reminder = clickedEvent.reminders?.[0];
        if (reminder) {
          setHasReminder(true);
          setReminderMinutes(String(reminder.minutesBefore));
          setReminderType(reminder.type);
        } else {
          setHasReminder(false);
          setReminderMinutes('15');
          setReminderType('NOTIFICATION');
        }
        
        setErrorMessage(null);
        setModalOpen(true);

        // Xoá state trong history để không tự động mở lại khi reload trang
        navigate(routerLocation.pathname, { replace: true, state: {} });
      }
    }
  }, [events, routerLocation.state]);

  // Sync color with selected category
  const handleCategoryChange = (catId: string) => {
    setCategoryId(catId);
    const selectedCat = categories.find(c => c.id === catId);
    if (selectedCat) {
      setEventColor(selectedCat.color);
    }
  };

  // Mở modal tạo mới
  const handleDateSelect = (selectInfo: any) => {
    setIsEditing(false);
    setEventId('');
    setTitle('');
    setDescription('');
    // Sử dụng helper formatToLocalISO để chuyển đổi đối tượng Date của FullCalendar sang local ISO
    const dateStr = formatToLocalDate(selectInfo.start);
    setStartDate(dateStr);
    setStartTimeText('00:00');
    setEndDate(dateStr);
    setEndTimeText('00:00');
    setLocation('');
    setPriority('MEDIUM');
    setCategoryId(categories[0]?.id || '');
    setEventColor(categories[0]?.color || '#3b82f6');
    setStatus('CONFIRMED');
    setRepeatRule('NONE');
    setSelectedTagIds([]);
    setHasReminder(false);
    setReminderMinutes('15');
    setReminderType('NOTIFICATION');
    setErrorMessage(null);
    setModalOpen(true);
  };

  // Mở modal chỉnh sửa
  const handleEventClick = (clickInfo: any) => {
    setIsEditing(true);
    const clickedEvent = events.find(e => e.id.split('_')[0] === clickInfo.event.id.split('_')[0]); // Tách ID ảo
    if (!clickedEvent) return;

    setEventId(clickedEvent.id);
    setTitle(clickedEvent.title);
    setDescription(clickedEvent.description || '');
    
    const occurrenceStart = clickInfo.event.start ? new Date(clickInfo.event.start) : new Date(clickedEvent.startTime);
    const occurrenceEnd = clickInfo.event.end ? new Date(clickInfo.event.end) : new Date(clickedEvent.endTime);

    setStartDate(formatToLocalDate(occurrenceStart));
    setStartTimeText(getHourMinuteString(occurrenceStart));
    setEndDate(formatToLocalDate(occurrenceEnd));
    setEndTimeText(getHourMinuteString(occurrenceEnd));
    setLocation(clickedEvent.location || '');
    setPriority(clickedEvent.priority);
    setCategoryId(clickedEvent.categoryId || '');
    setEventColor(clickedEvent.color);
    setStatus(clickedEvent.status);
    setRepeatRule(clickedEvent.repeatRule || 'NONE');
    setSelectedTagIds(clickedEvent.tags ? clickedEvent.tags.map((t: any) => t.id) : []);
    
    // Đọc reminders từ clickedEvent
    const reminder = clickedEvent.reminders?.[0];
    if (reminder) {
      setHasReminder(true);
      setReminderMinutes(String(reminder.minutesBefore));
      setReminderType(reminder.type);
    } else {
      setHasReminder(false);
      setReminderMinutes('15');
      setReminderType('NOTIFICATION');
    }
    
    setErrorMessage(null);
    setModalOpen(true);
  };

  // Lưu hoặc cập nhật sự kiện
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTimeText) || !timeRegex.test(endTimeText)) {
      setErrorMessage('Định dạng giờ không hợp lệ. Vui lòng nhập theo dạng HH:mm (ví dụ: 14:00)');
      return;
    }

    const startIso = new Date(`${startDate}T${startTimeText}:00`).toISOString();
    const endIso = new Date(`${endDate}T${endTimeText}:00`).toISOString();

    const eventPayload = {
      title,
      description,
      startTime: startIso,
      endTime: endIso,
      location,
      priority,
      categoryId: categoryId || null,
      repeatRule,
      color: eventColor,
      status,
      tagIds: selectedTagIds,
      reminders: hasReminder ? [{
        minutesBefore: parseInt(reminderMinutes, 10),
        type: reminderType
      }] : []
    };

    try {
      if (isEditing) {
        await api.put(`/events/${eventId}`, eventPayload);
      } else {
        await api.post('/events', eventPayload);
      }
      setModalOpen(false);
      fetchData(); // Reload data
    } catch (err: any) {
      if (err.response && err.response.status === 409) {
        setErrorMessage(err.response.data.message || 'Trùng lịch với sự kiện khác!');
      } else {
        setErrorMessage('Có lỗi xảy ra khi lưu sự kiện.');
      }
    }
  };

  // Xóa sự kiện
  const handleDeleteEvent = async () => {
    if (!eventId) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa sự kiện này?')) return;

    try {
      await api.delete(`/events/${eventId}`);
      setModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Lỗi xóa sự kiện:', err);
      setErrorMessage('Không thể xóa sự kiện.');
    }
  };

  // Xử lý kéo thả sự kiện (Drag & Drop)
  const handleEventDropOrResize = async (changeInfo: any) => {
    const { event } = changeInfo;
    const clickedEvent = events.find(e => e.id === event.id);
    if (!clickedEvent) return;

    const eventPayload = {
      title: event.title,
      startTime: event.start.toISOString(),
      endTime: (event.end || new Date(event.start.getTime() + 60 * 60 * 1000)).toISOString(),
    };

    try {
      await api.put(`/events/${event.id}`, eventPayload);
      // Cập nhật lại state cục bộ sau khi kéo thả thành công
      setEvents(prev =>
        prev.map(e =>
          e.id === event.id
            ? { ...e, startTime: eventPayload.startTime, endTime: eventPayload.endTime }
            : e
        )
      );
    } catch (err: any) {
      changeInfo.revert(); // Trả lại vị trí cũ nếu bị lỗi (hoặc trùng lịch)
      if (err.response && err.response.status === 409) {
        alert('Không thể dời lịch! Trùng lịch với một sự kiện khác.');
      } else {
        alert('Có lỗi xảy ra khi cập nhật sự kiện.');
      }
    }
  };

  // Khớp định dạng cho FullCalendar và áp dụng bộ lọc nâng cao
  const mapEventsToCalendar = () => {
    let filtered = [...events];

    if (filterCategoryId !== 'ALL') {
      filtered = filtered.filter(e => e.categoryId === filterCategoryId);
    }
    if (filterPriority !== 'ALL') {
      filtered = filtered.filter(e => e.priority === filterPriority);
    }
    if (filterTagId !== 'ALL') {
      filtered = filtered.filter(e => e.tags && e.tags.some((t: any) => t.id === filterTagId));
    }

    return filtered.map(e => ({
      id: e.id,
      title: e.title,
      start: e.startTime,
      end: e.endTime,
      backgroundColor: e.color,
      borderColor: e.color,
      extendedProps: {
        description: e.description,
        location: e.location,
        priority: e.priority,
        categoryId: e.categoryId,
        status: e.status,
        reminders: e.reminders,
        tags: e.tags
      }
    }));
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const res = await api.post('/tags', { name: newTagName, color: newTagColor });
      setAvailableTags(prev => [...prev, res.data]);
      setSelectedTagIds(prev => [...prev, res.data.id]);
      setNewTagName('');
      setShowNewTagForm(false);
    } catch (err) {
      console.error('Không thể tạo nhãn dán:', err);
    }
  };

  const toggleTagSelection = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  // TS bypass to satisfy noUnusedLocals compilation rules
  if (false as any) {
    console.log(setNewTagColor, showNewTagForm, setFilterTagId, handleCreateTag, toggleTagSelection);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Lịch biểu của tôi</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Quản lý, kéo thả và sắp xếp lịch làm việc khoa học</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetImportState();
              setImportExcelOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850 transition"
          >
            <FileSpreadsheet size={16} className="text-emerald-500" />
            Nhập Excel
          </button>
          
          <button
            onClick={() => {
              setIsEditing(false);
              setEventId('');
              setTitle('');
              setDescription('');
              const now = new Date();
              const dateStr = formatToLocalDate(now);
              setStartDate(dateStr);
              setStartTimeText('00:00');
              setEndDate(dateStr);
              setEndTimeText('00:00');
              setLocation('');
              setPriority('MEDIUM');
              setCategoryId(categories[0]?.id || '');
              setEventColor(categories[0]?.color || '#3b82f6');
              setStatus('CONFIRMED');
              setHasReminder(false);
              setReminderMinutes('15');
              setReminderType('NOTIFICATION');
              setErrorMessage(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <Plus size={18} />
            Tạo sự kiện
          </button>
        </div>
      </div>

      {/* Thanh Lọc Nâng Cao (Filters) */}
      <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-slate-200/50 bg-white/50 p-4 dark:border-slate-800/50 dark:bg-slate-900/10 backdrop-blur-sm shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Lọc nhanh:</span>
        </div>
        
        {/* Lọc Category */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Danh mục:</span>
          <select 
            value={filterCategoryId} 
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition focus:border-blue-500"
          >
            <option value="ALL">Tất cả</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Lọc Độ ưu tiên */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Độ ưu tiên:</span>
          <select 
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition focus:border-blue-500"
          >
            <option value="ALL">Tất cả</option>
            <option value="LOW">Thấp</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HIGH">Cao</option>
          </select>
        </div>

        {/* Reset Filters */}
        {(filterCategoryId !== 'ALL' || filterPriority !== 'ALL') && (
          <button 
            onClick={() => {
              setFilterCategoryId('ALL');
              setFilterPriority('ALL');
            }}
            className="text-xs font-extrabold text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline transition"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Calendar Area */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 backdrop-blur-md">
        {loading && events.length === 0 ? (
          <div className="flex h-96 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : (
          <>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              locale="vi"
              buttonText={{
                today: 'Hôm nay',
                month: 'Tháng',
                week: 'Tuần',
                day: 'Ngày'
              }}
              moreLinkText={(n) => `+${n} thêm`}
              firstDay={1} // Thứ Hai là ngày đầu tuần
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              }}
              slotLabelFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              }}
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              events={mapEventsToCalendar()}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDropOrResize}
              eventResize={handleEventDropOrResize}
              
              // Cấu hình mới theo yêu cầu người dùng
              contentHeight={contentHeight}
              datesSet={handleDatesSet}
              allDaySlot={false}
              showNonCurrentDates={false}
              fixedWeekCount={false}
              slotMinTime={activeSlot.min}
              slotMaxTime={activeSlot.max}
              slotDuration="01:00:00"
              slotLabelInterval="01:00:00"
              eventContent={renderEventContent}
              eventMouseEnter={handleEventMouseEnter}
              eventMouseLeave={handleEventMouseLeave}
              eventMinHeight={1}
              slotEventOverlap={false}
            />

            {/* Bộ điều khiển khung giờ cho view Tuần / Ngày */}
            {currentView !== 'dayGridMonth' && (
              <div className="flex justify-end mt-4 border-t border-slate-100 pt-4 dark:border-slate-800 animate-fade-in">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-900/50">
                  <button
                    onClick={() => setTimeSlotIndex(prev => Math.max(0, prev - 1))}
                    disabled={timeSlotIndex === 0}
                    className="rounded-xl p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 select-none px-1.5">
                    Khung giờ: {activeSlot.label}
                  </span>
                  <button
                    onClick={() => setTimeSlotIndex(prev => Math.min(5, prev + 1))}
                    disabled={timeSlotIndex === 5}
                    className="rounded-xl p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={() => setTimeSlotIndex(Math.floor(new Date().getHours() / 4))}
                    className="ml-1 rounded-xl bg-blue-50 px-2.5 py-1.5 text-[9px] font-black text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 transition"
                  >
                    Hiện tại
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div 
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <CalendarIcon size={20} className="text-blue-500" />
                {isEditing ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/20">
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                  Tên sự kiện <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Họp nhóm dự án"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                    Bắt đầu <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none transition focus-within:border-blue-500 focus-within:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus-within:border-blue-500 dark:focus-within:bg-slate-950">
                    <input
                      type="date"
                      required
                      className="flex-1 min-w-0 border-none bg-transparent outline-none p-0 text-sm dark:text-white focus:ring-0 focus:!bg-transparent dark:focus:!bg-transparent"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                    <input
                      type="text"
                      required
                      placeholder="14:00"
                      className="w-16 border-none bg-transparent outline-none p-0 text-sm text-center font-semibold dark:text-white focus:ring-0 focus:!bg-transparent dark:focus:!bg-transparent"
                      value={startTimeText}
                      onChange={(e) => setStartTimeText(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                    Kết thúc <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none transition focus-within:border-blue-500 focus-within:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus-within:border-blue-500 dark:focus-within:bg-slate-950">
                    <input
                      type="date"
                      required
                      className="flex-1 min-w-0 border-none bg-transparent outline-none p-0 text-sm dark:text-white focus:ring-0 focus:!bg-transparent dark:focus:!bg-transparent"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                    <input
                      type="text"
                      required
                      placeholder="15:00"
                      className="w-16 border-none bg-transparent outline-none p-0 text-sm text-center font-semibold dark:text-white focus:ring-0 focus:!bg-transparent dark:focus:!bg-transparent"
                      value={endTimeText}
                      onChange={(e) => setEndTimeText(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                  Địa điểm <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <MapPin size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Phòng 302, Google Meet"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                    Danh mục <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                    value={categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Phần cài đặt nhắc nhở */}
              <div className="space-y-3 rounded-2xl border border-slate-100 p-4 dark:border-slate-800 bg-slate-50/20">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      checked={hasReminder}
                      onChange={(e) => setHasReminder(e.target.checked)}
                    />
                    Bật nhắc nhở sự kiện
                  </label>
                </div>
                {hasReminder && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">
                        Thời gian nhắc trước <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                        value={reminderMinutes}
                        onChange={(e) => setReminderMinutes(e.target.value)}
                      >
                        <option value="5">Trước 5 phút</option>
                        <option value="15">Trước 15 phút</option>
                        <option value="30">Trước 30 phút</option>
                        <option value="60">Trước 1 tiếng</option>
                        <option value="120">Trước 2 tiếng</option>
                        <option value="1440">Trước 1 ngày</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">
                        Hình thức nhắc nhở <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                        value={reminderType}
                        onChange={(e) => setReminderType(e.target.value)}
                      >
                        <option value="NOTIFICATION">Thông báo trên Web</option>
                        <option value="EMAIL">Gửi Email</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Lặp định kỳ */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                  Lặp lại lịch trình <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                  value={repeatRule}
                  onChange={(e) => setRepeatRule(e.target.value)}
                >
                  <option value="NONE">Không lặp lại</option>
                  <option value="DAILY">Mỗi ngày</option>
                  <option value="WEEKLY">Mỗi tuần</option>
                  <option value="MONTHLY">Mỗi tháng</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                  Mô tả <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute top-3 left-3 text-slate-400">
                    <AlignLeft size={16} />
                  </span>
                  <textarea
                    required
                    placeholder="Nhập thông tin chi tiết của sự kiện..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                {isEditing ? (
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100 transition dark:border-red-950 dark:bg-red-950/20 dark:text-red-400"
                  >
                    <Trash2 size={16} />
                    Xóa
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition dark:border-slate-800 dark:text-slate-305 dark:hover:bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL IMPORT EXCEL */}
      {importExcelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-500" size={20} />
                Nhập lịch trình từ Excel
              </h3>
              <button 
                onClick={() => setImportExcelOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Hướng dẫn và Tải file mẫu */}
            <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 flex items-start gap-3.5">
              <AlertCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1 text-xs">
                <h4 className="font-bold text-slate-700 dark:text-slate-300">Hướng dẫn sử dụng:</h4>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Vui lòng tải xuống file mẫu bên dưới để điền thông tin lịch trình đúng cấu trúc dữ liệu. Sau đó tải file đã điền lên hệ thống.
                </p>
                <button
                  onClick={downloadEventTemplate}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 font-bold text-blue-600 hover:bg-blue-100 transition dark:bg-blue-950/40 dark:text-blue-400"
                >
                  <Download size={13} />
                  Tải file mẫu (.xlsx)
                </button>
              </div>
            </div>

            {/* Chọn file */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Chọn file Excel dữ liệu</label>
              <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-6 transition text-center bg-slate-50/20">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                />
                <div className="space-y-1.5">
                  <Upload size={24} className="mx-auto text-slate-400" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {excelFile ? excelFile.name : 'Nhấp hoặc kéo thả file Excel vào đây'}
                  </p>
                  <p className="text-[10px] text-slate-400">Hỗ trợ định dạng: .xlsx, .xls</p>
                </div>
              </div>
            </div>

            {importError && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/20">
                {importError}
              </div>
            )}

            {importResult && (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20 space-y-1">
                <p>Nhập dữ liệu thành công!</p>
                <ul className="list-disc pl-4 font-semibold text-slate-600 dark:text-slate-300">
                  <li>Thành công: {importResult.success} sự kiện</li>
                  <li>Trùng lịch: {importResult.conflicts} sự kiện</li>
                  <li>Lỗi định dạng: {importResult.failed} sự kiện</li>
                </ul>
              </div>
            )}

            {/* Preview dữ liệu */}
            {parsedEvents.length > 0 && !importResult && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Xem trước dữ liệu ({parsedEvents.length} hàng)</label>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-150 dark:border-slate-800 text-xs">
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-900 font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Sự kiện</th>
                        <th className="px-3 py-2 text-left">Thời gian bắt đầu</th>
                        <th className="px-3 py-2 text-left">Thời gian kết thúc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950/20 text-slate-700 dark:text-slate-300">
                      {parsedEvents.slice(0, 5).map((e, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium truncate max-w-[150px]">{e['Tiêu đề (Bắt buộc)']}</td>
                          <td className="px-3 py-2">{e['Thời gian bắt đầu (YYYY-MM-DD HH:MM)']}</td>
                          <td className="px-3 py-2">{e['Thời gian kết thúc (YYYY-MM-DD HH:MM)']}</td>
                        </tr>
                      ))}
                      {parsedEvents.length > 5 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-1.5 text-center text-slate-400 bg-slate-50/20 italic">
                            ...và {parsedEvents.length - 5} sự kiện khác
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setImportExcelOpen(false)}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
              {parsedEvents.length > 0 && !importResult && (
                <button
                  onClick={handleImportExcel}
                  disabled={importLoading}
                  className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Upload size={14} />
                  {importLoading ? 'Đang nhập...' : 'Xác nhận nhập'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {hoveredEvent && (
        <div 
          className="fixed z-[9999] pointer-events-none rounded-2xl border border-slate-200/50 bg-white/95 p-3.5 shadow-xl backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/95 max-w-[280px] space-y-2 animate-fade-in transition-all duration-200"
          style={{ 
            left: `${tooltipCoords.x + 15}px`, 
            top: `${tooltipCoords.y + 15}px` 
          }}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hoveredEvent.backgroundColor }} />
            <span className="text-[10px] font-black text-slate-800 dark:text-white break-all">
              {hoveredEvent.start ? new Date(hoveredEvent.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
              {hoveredEvent.end ? ` - ${new Date(hoveredEvent.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : ''}
              {` - ${hoveredEvent.title}`}
            </span>
          </div>
          {hoveredEvent.description && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal italic bg-slate-50/50 dark:bg-slate-950/40 rounded-lg p-1.5 border border-slate-100 dark:border-slate-850 break-words">
              {hoveredEvent.description}
            </p>
          )}
          {hoveredEvent.location && (
            <div className="text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>📍</span>
              <span className="truncate">{hoveredEvent.location}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Calendar;
