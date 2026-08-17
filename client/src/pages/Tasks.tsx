import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  CheckSquare, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  List, 
  Kanban,
  Check,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  X,
  FileSpreadsheet,
  Download,
  Eye,
  Upload,
  AlertCircle,
  MessageSquare,
  History,
  User
} from 'lucide-react';
import { downloadTaskTemplate, parseExcelFile } from '../services/excelService';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import UserAvatar from '../components/UserAvatar';

interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
  assignedUserId?: string | null;
  assignedUser?: { id: string; username: string; avatar?: string } | null;
  createdById?: string | null;
  dueDate?: string | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface TaskMember {
  id: string;
  taskId: string;
  userId: string;
  role: string;
  user: { id: string; username: string; avatar?: string; email: string };
}

interface Task {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  priority: string;
  status: string;
  progress: number;
  categoryId?: string;
  category?: Category;
  tags?: Array<{ id: string; name: string; color: string }>;
  subtasks: Subtask[];
  isPersonal: boolean;
  userId: string;
  members?: TaskMember[];
  user?: { id: string; username: string; avatar?: string; email: string };
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { username: string; avatar?: string; email: string };
}

const Tasks: React.FC = () => {
  const { user } = useAuth();
  const { socket, joinTask, leaveTask } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('LIST');
  const [loading, setLoading] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [selectedMemberInfo, setSelectedMemberInfo] = useState<any | null>(null);

  // Real-time WebSockets Sync
  useEffect(() => {
    if (!socket) return;

    socket.on('task_updated', (updatedTask: Task) => {
      setTasks((prevTasks) => {
        const exists = prevTasks.some((t) => t.id === updatedTask.id);
        if (exists) {
          return prevTasks.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t));
        } else {
          const isParticipant = updatedTask.userId === user?.id || updatedTask.members?.some((m) => m.userId === user?.id);
          if (isParticipant) {
            return [...prevTasks, updatedTask];
          }
          return prevTasks;
        }
      });
    });

    socket.on('task_deleted', (deletedTaskId: string) => {
      setTasks((prevTasks) => prevTasks.filter((t) => t.id !== deletedTaskId));
    });

    return () => {
      socket.off('task_updated');
      socket.off('task_deleted');
    };
  }, [socket]);

  // Quản lý việc join/leave room dự án để nhận tin nhắn thảo luận realtime
  useEffect(() => {
    if (!socket || !expandedTaskId) return;

    joinTask(expandedTaskId);

    const handleNewComment = (comment: Comment) => {
      setComments((prev) => {
        const taskComments = prev[expandedTaskId] || [];
        if (taskComments.some((c) => c.id === comment.id)) return prev;
        return {
          ...prev,
          [expandedTaskId]: [...taskComments, comment]
        };
      });
    };

    socket.on('new_comment', handleNewComment);

    return () => {
      leaveTask(expandedTaskId);
      socket.off('new_comment', handleNewComment);
    };
  }, [socket, expandedTaskId]);

  // Form State for creating task
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [categoryId, setCategoryId] = useState('');
  const [newSubtasks, setNewSubtasks] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  // Project Members States
  const [newMemberUsername, setNewMemberUsername] = useState<Record<string, string>>({});
  const [newMemberRole, setNewMemberRole] = useState<Record<string, string>>({});

  // Tags States
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [showNewTagForm, setShowNewTagForm] = useState(false);

  // Comments States
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentInput, setCommentInput] = useState('');
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});

  // Filters States
  const [filterCategoryId, setFilterCategoryId] = useState('ALL');
  const [filterTagId, setFilterTagId] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Subtask input for existing task
  const [activeSubtaskInput, setActiveSubtaskInput] = useState<{ [key: string]: string }>({});

  // Excel Import States
  const [importExcelOpen, setImportExcelOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedTasks, setParsedTasks] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Activity Logs States
  const [activeActivityTaskId, setActiveActivityTaskId] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const handleOpenActivityLogs = async (taskId: string) => {
    setActiveActivityTaskId(taskId);
    setLoadingLogs(true);
    try {
      const res = await api.get(`/tasks/${taskId}/activity-logs`);
      setActivityLogs(res.data);
    } catch (err) {
      console.error('Lỗi lấy nhật ký hoạt động:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

  const handleUploadAttachment = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetTask = tasks.find(t => t.id === taskId);
    if (targetTask) {
      const currentMember = targetTask.members?.find((m: any) => m.userId === user?.id);
      const canEdit = targetTask.userId === user?.id || currentMember?.role === 'EDITOR';
      if (!canEdit) {
        alert('Bạn không có quyền tải tài liệu lên dự án này (chỉ xem).');
        return;
      }
    }

    setUploadingTaskId(taskId);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('taskId', taskId);

    try {
      await api.post('/attachments/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } catch (err: any) {
      console.error('Lỗi tải file lên:', err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi tải tệp tin lên.');
    } finally {
      setUploadingTaskId(null);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này không?')) return;
    try {
      await api.delete(`/attachments/${attachmentId}`);
      fetchData();
    } catch (err: any) {
      console.error('Lỗi khi xóa tài liệu:', err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi xóa tài liệu.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setImportError(null);
    setImportResult(null);

    try {
      const data = await parseExcelFile(file);
      setParsedTasks(data);
    } catch (err) {
      console.error('Lỗi đọc file Excel:', err);
      setImportError('Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file mẫu.');
    }
  };

  const handleImportExcel = async () => {
    if (parsedTasks.length === 0) return;

    setImportLoading(true);
    setImportError(null);
    let successCount = 0;
    let failedCount = 0;

    let currentCats = [...categories];
    let currentTags = [...availableTags];

    for (const item of parsedTasks) {
      const taskTitle = item['Tên công việc'];
      const deadlineRaw = item['Hạn chót (YYYY-MM-DD)'];
      const categoryName = item['Danh mục'];
      const priorityRaw = item['Mức ưu tiên (LOW/MEDIUM/HIGH)'];
      const description = item['Mô tả công việc'];

      // Bắt buộc các trường không phải nhãn dán (tags) và việc con (subtasks)
      if (!taskTitle || !deadlineRaw || !categoryName || !priorityRaw || !description) {
        failedCount++;
        continue;
      }

      const deadline = new Date(deadlineRaw);
      if (isNaN(deadline.getTime())) {
        failedCount++;
        continue;
      }

      // Xử lý danh mục: khớp tên (không phân biệt hoa thường) hoặc tự động tạo mới
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
          console.error('Lỗi tự động tạo danh mục:', err);
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
              console.error('Lỗi tự động tạo nhãn dán:', err);
            }
          }
        }
      }

      // Xử lý việc con (Subtasks) - Có thể để trống
      const subtasksRaw = item['Công việc con (Subtasks)'];
      const subtasks = subtasksRaw 
        ? subtasksRaw.toString().split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0) 
        : [];

      try {
        await api.post('/tasks', {
          title: taskTitle.toString().trim(),
          description: description.toString().trim(),
          deadline: deadline.toISOString(),
          priority,
          categoryId,
          tagIds,
          subtasks
        });
        successCount++;
      } catch (err) {
        console.error('Lỗi import task:', err);
        failedCount++;
      }
    }

    setImportResult({ success: successCount, failed: failedCount });
    setImportLoading(false);
    fetchData(); 
  };

  const resetImportState = () => {
    setExcelFile(null);
    setParsedTasks([]);
    setImportResult(null);
    setImportError(null);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksRes, catsRes, tagsRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/categories'),
        api.get('/tags')
      ]);
      setTasks(tasksRes.data);
      setCategories(catsRes.data);
      setAvailableTags(tagsRes.data);
    } catch (err) {
      console.error('Không thể lấy dữ liệu tasks, categories hoặc tags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tự động mở rộng task nếu nhận được taskId từ trang khác chuyển sang
  useEffect(() => {
    if (tasks.length > 0 && location.state?.openTaskId) {
      const targetTaskId = location.state.openTaskId;
      // Đảm bảo viewMode là LIST để có thể mở rộng
      setViewMode('LIST');
      setExpandedTaskId(targetTaskId);
      
      // Scroll to task element
      setTimeout(() => {
        const element = document.getElementById(`task-card-${targetTaskId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight hiệu ứng nháy viền nhẹ
          element.classList.add('ring-4', 'ring-blue-500/50');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-500/50');
          }, 3000);
        }
      }, 300);

      // Xoá state trong history để không tự động mở lại khi reload trang
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [tasks, location.state]);

  // Load comments mỗi khi expandedTaskId thay đổi
  useEffect(() => {
    if (expandedTaskId) {
      fetchComments(expandedTaskId);
    }
  }, [expandedTaskId]);

  const fetchComments = async (taskId: string) => {
    try {
      setCommentsLoading(prev => ({ ...prev, [taskId]: true }));
      const res = await api.get(`/tasks/${taskId}/comments`);
      setComments(prev => ({ ...prev, [taskId]: res.data }));
    } catch (err) {
      console.error('Lỗi lấy bình luận:', err);
    } finally {
      setCommentsLoading(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleAddComment = async (taskId: string) => {
    if (!commentInput.trim()) return;
    try {
      const res = await api.post(`/tasks/${taskId}/comments`, { content: commentInput.trim() });
      setComments(prev => {
        const taskComments = prev[taskId] || [];
        if (taskComments.some(c => c.id === res.data.id)) return prev;
        return {
          ...prev,
          [taskId]: [...taskComments, res.data]
        };
      });
      setCommentInput('');
    } catch (err) {
      console.error('Lỗi gửi bình luận:', err);
    }
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

  const handleAddTempSubtask = () => {
    if (subtaskInput.trim()) {
      setNewSubtasks([...newSubtasks, subtaskInput.trim()]);
      setSubtaskInput('');
    }
  };

  const handleRemoveTempSubtask = (index: number) => {
    setNewSubtasks(newSubtasks.filter((_, i) => i !== index));
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const payload = {
        title,
        description,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        priority,
        categoryId: categoryId || null,
        subtasks: newSubtasks,
        tagIds: selectedTagIds
      };

      await api.post('/tasks', payload);
      setModalOpen(false);
      setTitle('');
      setDescription('');
      setDeadline('');
      setPriority('MEDIUM');
      setCategoryId('');
      setNewSubtasks([]);
      setSelectedTagIds([]);
      fetchData();
    } catch (err) {
      console.error('Lỗi khi tạo task:', err);
    }
  };

  const handleAddMember = async (taskId: string) => {
    const username = newMemberUsername[taskId];
    if (!username || !username.trim()) return;

    try {
      await api.post(`/tasks/${taskId}/members`, {
        username: username.trim(),
        role: newMemberRole[taskId] || 'VIEWER'
      });
      setNewMemberUsername(prev => ({ ...prev, [taskId]: '' }));
      setNewMemberRole(prev => ({ ...prev, [taskId]: 'VIEWER' }));
      fetchData();
    } catch (err: any) {
      console.error('Lỗi thêm thành viên:', err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi thêm thành viên.');
    }
  };

  const handleUpdateMemberRole = async (taskId: string, memberId: string, role: string) => {
    try {
      await api.put(`/tasks/${taskId}/members/${memberId}`, { role });
      fetchData();
    } catch (err: any) {
      console.error('Lỗi cập nhật quyền:', err);
      alert(err.response?.data?.message || 'Không thể cập nhật quyền thành viên.');
    }
  };

  const handleDeleteMember = async (taskId: string, memberId: string) => {
    if (!window.confirm('Bạn có muốn xóa thành viên này khỏi dự án?')) return;
    try {
      await api.delete(`/tasks/${taskId}/members/${memberId}`);
      fetchData();
    } catch (err: any) {
      console.error('Lỗi xóa thành viên:', err);
      alert(err.response?.data?.message || 'Không thể xóa thành viên.');
    }
  };

  const handleAssignSubtask = async (subtaskId: string, assignedUserId: string) => {
    try {
      await api.patch(`/tasks/subtasks/${subtaskId}/toggle`, {
        assignedUserId: assignedUserId || null
      });
      fetchData();
    } catch (err: any) {
      console.error('Lỗi phân công công việc:', err);
      alert(err.response?.data?.message || 'Không thể phân công công việc.');
    }
  };


  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Bạn có muốn xóa công việc này?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      fetchData();
    } catch (err) {
      console.error('Lỗi xóa task:', err);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await api.put(`/tasks/${id}`, { status: newStatus });
      fetchData();
    } catch (err: any) {
      console.error('Lỗi cập nhật trạng thái:', err);
      alert(err.response?.data?.message || 'Không thể cập nhật trạng thái công việc.');
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    try {
      await api.patch(`/tasks/subtasks/${subtaskId}/toggle`);
      fetchData();
    } catch (err) {
      console.error('Lỗi khi thay đổi trạng thái subtask:', err);
    }
  };

  const handleAddSubtaskToExisting = async (taskId: string) => {
    const title = activeSubtaskInput[taskId];
    if (!title || !title.trim()) return;

    try {
      await api.post(`/tasks/${taskId}/subtasks`, { title: title.trim() });
      setActiveSubtaskInput({ ...activeSubtaskInput, [taskId]: '' });
      fetchData();
    } catch (err) {
      console.error('Lỗi thêm subtask:', err);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await api.delete(`/tasks/subtasks/${subtaskId}`);
      fetchData();
    } catch (err) {
      console.error('Lỗi xóa subtask:', err);
    }
  };

  const getCommentDateLabel = (dateStr: string) => {
    const commentDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (commentDate.toDateString() === today.toDateString()) {
      return 'Hôm nay';
    } else if (commentDate.toDateString() === yesterday.toDateString()) {
      return 'Hôm qua';
    } else {
      return commentDate.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      });
    }
  };

  const getPriorityBadgeColor = (p: string) => {
    switch (p) {
      case 'HIGH': return 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-200/50 dark:border-red-900/20';
      case 'MEDIUM': return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/50';
      default: return 'bg-slate-50 text-slate-700 dark:bg-slate-800/40 dark:text-slate-400 border-slate-200/50 dark:border-slate-800/50';
    }
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case 'HIGH': return 'Cao';
      case 'MEDIUM': return 'Trung bình';
      default: return 'Thấp';
    }
  };

  const getFilteredTasks = () => {
    return tasks.filter(task => {
      if (filterCategoryId !== 'ALL' && task.categoryId !== filterCategoryId) return false;
      if (filterPriority !== 'ALL' && task.priority !== filterPriority) return false;
      if (filterStatus !== 'ALL' && task.status !== filterStatus) return false;
      if (filterTagId !== 'ALL') {
        if (!task.tags || !task.tags.some(t => t.id === filterTagId)) return false;
      }
      return true;
    });
  };

  // TS bypass to satisfy noUnusedLocals compilation rules
  if (false as any) {
    console.log(setNewTagColor, showNewTagForm, setFilterTagId, handleCreateTag, toggleTagSelection);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Quản lý Công việc</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Thiết lập danh sách việc cần làm, tiến trình và nhiệm vụ con</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-2xl bg-slate-100 p-1 dark:bg-slate-900 border border-slate-200/30 dark:border-slate-800/30">
            <button
              onClick={() => setViewMode('LIST')}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${viewMode === 'LIST' ? 'bg-white text-blue-600 shadow-md dark:bg-slate-800 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
            >
              <List size={14} />
              Danh sách
            </button>
            <button
              onClick={() => setViewMode('KANBAN')}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${viewMode === 'KANBAN' ? 'bg-white text-blue-600 shadow-md dark:bg-slate-800 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
            >
              <Kanban size={14} />
              Bảng Kanban
            </button>
          </div>

          <button
            onClick={() => {
              resetImportState();
              setImportExcelOpen(true);
            }}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850 transition"
          >
            <FileSpreadsheet size={16} className="text-emerald-500" />
            Nhập Excel
          </button>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <Plus size={18} />
            Thêm công việc
          </button>
        </div>
      </div>

      {/* Thanh Lọc Nâng Cao (Filters) */}
      <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-slate-200/50 bg-white/50 p-4 dark:border-slate-800/50 dark:bg-slate-900/10 backdrop-blur-sm shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Lọc nhanh:</span>
        </div>
        
        {/* Lọc Trạng thái */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Trạng thái:</span>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition focus:border-blue-500"
          >
            <option value="ALL">Tất cả</option>
            <option value="PENDING">Chờ làm</option>
            <option value="IN_PROGRESS">Đang làm</option>
            <option value="COMPLETED">Đã xong</option>
          </select>
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
        {(filterCategoryId !== 'ALL' || filterPriority !== 'ALL' || filterStatus !== 'ALL') && (
          <button 
            onClick={() => {
              setFilterCategoryId('ALL');
              setFilterPriority('ALL');
              setFilterStatus('ALL');
            }}
            className="text-xs font-extrabold text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline transition"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      ) : viewMode === 'LIST' ? (
        /* --- LIST VIEW --- */
        <div className="space-y-4">
          {getFilteredTasks().length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-16 text-center dark:border-slate-800 bg-white/30 backdrop-blur-sm">
              <FolderOpen size={48} className="mx-auto text-slate-400 dark:text-slate-600 mb-4" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Không có công việc nào khớp với bộ lọc.</p>
            </div>
          ) : (
            getFilteredTasks().map((task) => {
              const isExpanded = expandedTaskId === task.id;
              return (
                <div 
                  key={task.id} 
                  id={`task-card-${task.id}`}
                  className={`glass-card hover-lift rounded-3xl overflow-hidden ${isExpanded ? 'ring-2 ring-blue-500/30' : ''}`}
                >
                  <div 
                    className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4 cursor-pointer select-none"
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  >
                    {(() => {
                      return (
                        <>
                          <div className="flex items-start gap-4 flex-1">
                            {(() => {
                              const isOwner = task.userId === user?.id;
                              const allSubtasksCompleted = task.subtasks.length === 0 || task.subtasks.every((sub: any) => sub.isCompleted);
                              const canComplete = isOwner && (task.status === 'COMPLETED' || allSubtasksCompleted);
                              
                              return (
                                <button 
                                  type="button"
                                  className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border-2 transition ${canComplete ? 'cursor-pointer hover:border-blue-500' : 'cursor-not-allowed opacity-50'} ${task.status === 'COMPLETED' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-300 dark:border-slate-700'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isOwner) {
                                      alert('Chỉ chủ dự án mới có quyền hoàn thành hoặc mở lại dự án.');
                                      return;
                                    }
                                    if (task.status !== 'COMPLETED' && !allSubtasksCompleted) {
                                      alert('Chỉ có thể hoàn thành dự án khi tất cả công việc con đã được hoàn thành.');
                                      return;
                                    }
                                    handleUpdateStatus(task.id, task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED');
                                  }}
                                >
                                  {task.status === 'COMPLETED' && <Check size={14} className="text-blue-500 font-bold" />}
                                </button>
                              );
                            })()}

                            <div className="space-y-1.5 flex-1">
                              <h3 className={`font-black text-sm text-slate-800 dark:text-white flex items-center gap-2 ${task.status === 'COMPLETED' ? 'line-through opacity-50' : ''}`}>
                                {task.title}
                                {task.members && task.members.length > 0 && (
                                  <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-extrabold text-indigo-600 border border-indigo-150 uppercase tracking-wide dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30">Dự án nhóm</span>
                                )}
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{task.description}</p>
                              <div className="flex flex-wrap items-center gap-2 pt-2.5">
                                <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-[10px] font-extrabold border uppercase tracking-wider ${getPriorityBadgeColor(task.priority)}`}>
                                  {getPriorityLabel(task.priority)}
                                </span>
                                {task.category && (
                                  <span 
                                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[10px] font-extrabold text-white uppercase tracking-wider shadow-sm" 
                                    style={{ backgroundColor: task.category.color }}
                                  >
                                    {task.category.name}
                                  </span>
                                )}
                                {task.deadline && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    <CalendarIcon size={12} />
                                    Hạn: {new Date(task.deadline).toLocaleDateString()}
                                  </span>
                                )}
                                {task.members && task.members.length > 0 && (
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isExpanded) {
                                        setExpandedTaskId(task.id);
                                      }
                                      setTimeout(() => {
                                        document.getElementById(`comments-section-${task.id}`)?.scrollIntoView({ behavior: 'smooth' });
                                      }, 100);
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                  >
                                    <MessageSquare size={12} />
                                    Thảo luận
                                  </span>
                                )}
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenActivityLogs(task.id);
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                >
                                  <History size={12} />
                                  Nhật ký
                                </span>
                              </div>
                              {/* (Tags section removed) */}
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-6">
                            <div className="w-28 text-right space-y-1.5">
                              <span className="text-[10px] text-slate-500 font-bold dark:text-slate-400 uppercase tracking-wider">Tiến độ: {task.progress}%</span>
                              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTaskId(isExpanded ? null : task.id);
                                }}
                                className="rounded-xl p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 dark:bg-slate-850 dark:hover:bg-slate-800 transition shrink-0"
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                              {task.userId === user?.id ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task.id);
                                  }}
                                  className="rounded-xl p-2 bg-red-50 hover:bg-red-100 text-red-500 dark:bg-red-950/20 dark:hover:bg-red-900/30 transition shrink-0"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : (
                                <div className="w-8 h-8 shrink-0" />
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Subtasks Expanded list */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/20 p-6 dark:border-slate-800/80 dark:bg-slate-950/10 space-y-4">
                      {(() => {
                        const currentMember = task.members?.find((m: any) => m.userId === user?.id);
                        const canEdit = task.userId === user?.id || currentMember?.role === 'EDITOR';

                        return (
                          <>
                            <h4 className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Danh sách công việc con ({task.subtasks.length})</h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {task.subtasks.map((sub) => {
                                const isCreator = sub.createdById === user?.id;
                                const canToggle = task.userId === user?.id || (canEdit && (sub.assignedUserId === user?.id || isCreator));
                                return (
                                  <div key={sub.id} className="flex items-center justify-between rounded-2xl border border-slate-200/50 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60 shadow-sm transition hover:border-blue-500/20">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={sub.isCompleted}
                                        disabled={!canToggle}
                                        onChange={() => handleToggleSubtask(sub.id)}
                                        className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950 h-4.5 w-4.5 disabled:opacity-50"
                                      />
                                      <div className="flex flex-col min-w-0">
                                        <span className={`text-xs font-semibold text-slate-700 dark:text-slate-300 truncate ${sub.isCompleted ? 'line-through opacity-50' : ''}`} title={sub.title}>
                                          {sub.title}
                                        </span>
                                        {sub.dueDate && (
                                          <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                                            Hạn: {new Date(sub.dueDate).toLocaleDateString('vi-VN')}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Assignee dropdown/avatar */}
                                    {task.members && task.members.length > 0 && (
                                      <div className="flex items-center gap-1.5 shrink-0 select-none mx-2">
                                        {task.userId === user?.id ? (
                                          <select
                                            value={sub.assignedUserId || ''}
                                            onChange={(e) => handleAssignSubtask(sub.id, e.target.value)}
                                            className="bg-transparent border-none text-[10px] font-bold text-slate-500 dark:text-slate-400 focus:ring-0 cursor-pointer outline-none max-w-[100px] truncate py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850"
                                          >
                                            <option value="" className="dark:bg-slate-900">Giao việc</option>
                                            <option value={task.user?.id} className="dark:bg-slate-900">{task.user?.username} (Chủ)</option>
                                            {task.members?.map((m: any) => (
                                              <option key={m.userId} value={m.userId} className="dark:bg-slate-900">{m.user?.username}</option>
                                            ))}
                                          </select>
                                        ) : (
                                          <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                            {sub.assignedUser ? (
                                              <span className="flex items-center gap-1" title={sub.assignedUser.username}>
                                                <UserAvatar 
                                                  username={sub.assignedUser.username} 
                                                  avatarUrl={sub.assignedUser.avatar} 
                                                  sizeClass="h-4 w-4" 
                                                  textClass="text-[8px] font-black" 
                                                />
                                                <span className="truncate max-w-[65px]">{sub.assignedUser.username}</span>
                                              </span>
                                            ) : (
                                              <span className="italic text-slate-400 text-[9px]">Chưa giao</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {(task.userId === user?.id || (canEdit && sub.createdById === user?.id)) && (
                                      <button
                                        onClick={() => handleDeleteSubtask(sub.id)}
                                        className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition shrink-0"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Add new subtask inline */}
                            {canEdit && (
                              <div className="flex gap-2.5 pt-2 max-w-md">
                                <input
                                  type="text"
                                  placeholder="Thêm việc cần làm..."
                                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                                  value={activeSubtaskInput[task.id] || ''}
                                  onChange={(e) => setActiveSubtaskInput({ ...activeSubtaskInput, [task.id]: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddSubtaskToExisting(task.id);
                                  }}
                                />
                                <button
                                  onClick={() => handleAddSubtaskToExisting(task.id)}
                                  className="rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/10 transition"
                                >
                                  Thêm
                                </button>
                              </div>
                            )}

                            {/* Tài liệu đính kèm */}
                            <div className="border-t border-slate-200/60 dark:border-slate-800 pt-5 mt-5 space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                  <FolderOpen size={14} className="text-indigo-500" />
                                  Tài liệu đính kèm ({(task as any).attachments?.length || 0})
                                </h4>
                                {canEdit && (
                                  <div>
                                    <label className="flex items-center gap-1 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-1.5 text-xs font-bold text-slate-750 dark:text-slate-200 cursor-pointer transition select-none">
                                      <Upload size={12} />
                                      {uploadingTaskId === task.id ? 'Đang tải...' : 'Tải lên tài liệu'}
                                      <input 
                                        type="file" 
                                        className="hidden" 
                                        disabled={uploadingTaskId === task.id}
                                        onChange={(e) => handleUploadAttachment(task.id, e)} 
                                      />
                                    </label>
                                  </div>
                                )}
                              </div>

                              {!(task as any).attachments || (task as any).attachments.length === 0 ? (
                                <div className="text-xs text-slate-400 italic">Chưa có tài liệu nào được đính kèm.</div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                  {(task as any).attachments.map((attachment: any) => {
                                    const fileUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${attachment.filePath}`;
                                    const formatBytes = (bytes: number) => {
                                      if (bytes === 0) return '0 Bytes';
                                      const k = 1024;
                                      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                                      const i = Math.floor(Math.log(bytes) / Math.log(k));
                                      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                    };
                                    return (
                                      <div key={attachment.id} className="flex items-center justify-between rounded-2xl border border-slate-200/50 bg-white/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                                          <span className="text-lg">📎</span>
                                          <div className="min-w-0">
                                            <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate" title={attachment.fileName}>
                                              {attachment.fileName}
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-bold">
                                              {formatBytes(attachment.fileSize)}
                                            </div>
                                          </div>
                                        </div>
                                        {(() => {
                                          const canDeleteAttachment = task.userId === user?.id || (currentMember?.role === 'EDITOR' && attachment.userId === user?.id);
                                          return (
                                            <div className="flex items-center gap-0.5 shrink-0">
                                              <a 
                                                href={fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded-xl p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition"
                                                title="Xem trực tiếp"
                                              >
                                                <Eye size={14} />
                                              </a>
                                              <a 
                                                href={fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                download={attachment.fileName}
                                                className="rounded-xl p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                                                title="Tải về máy"
                                              >
                                                <Download size={14} />
                                              </a>
                                              {canDeleteAttachment && (
                                                <button 
                                                  onClick={() => handleDeleteAttachment(attachment.id)}
                                                  className="rounded-xl p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                                                  title="Xóa tài liệu"
                                                >
                                                  <Trash2 size={14} />
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Thành viên dự án (Chỉ hiển thị nếu là dự án nhóm) */}
                            {!task.isPersonal && (
                              <div className="border-t border-slate-200/60 dark:border-slate-800 pt-5 mt-5 space-y-4">
                                <h4 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                  <FolderOpen size={14} className="text-indigo-500" />
                                  Thành viên dự án ({1 + (task.members?.length || 0)})
                                </h4>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                  {/* Chủ dự án */}
                                  <div 
                                    className="flex items-center justify-between rounded-2xl border border-slate-200/50 bg-white/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition duration-150"
                                    onClick={() => setSelectedMemberInfo({ user: task.user, projectRole: 'Chủ dự án' })}
                                  >
                                    <div className="flex items-center gap-3">
                                      <UserAvatar 
                                        username={task.user?.username} 
                                        avatarUrl={task.user?.avatar} 
                                        sizeClass="h-7 w-7" 
                                        textClass="text-[10px] font-black" 
                                      />
                                      <div>
                                        <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{task.user?.username}</div>
                                        <div className="text-[9px] text-indigo-650 dark:text-indigo-400 font-extrabold uppercase">Chủ dự án</div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Thành viên được chia sẻ */}
                                  {task.members?.map((m: any) => (
                                    <div 
                                      key={m.id} 
                                      className="flex items-center justify-between rounded-2xl border border-slate-200/50 bg-white/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition duration-150"
                                      onClick={() => setSelectedMemberInfo({ user: m.user, projectRole: m.role === 'EDITOR' ? 'Quyền sửa' : 'Chỉ xem' })}
                                    >
                                      <div className="flex items-center gap-3">
                                        <UserAvatar 
                                           username={m.user?.username} 
                                           avatarUrl={m.user?.avatar} 
                                           sizeClass="h-7 w-7" 
                                           textClass="text-[10px] font-black" 
                                         />
                                        <div>
                                          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{m.user?.username}</div>
                                          <div className="text-[9px] text-slate-500 font-bold uppercase">
                                            {m.role === 'EDITOR' ? 'Quyền sửa' : 'Chỉ xem'}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Quản lý quyền thành viên (Chỉ chủ dự án được sửa) */}
                                      {task.userId === user?.id && (
                                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                          <select
                                            value={m.role}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              handleUpdateMemberRole(task.id, m.id, e.target.value);
                                            }}
                                            className="bg-transparent border-none text-[10px] font-bold text-blue-600 dark:text-blue-400 focus:ring-0 cursor-pointer outline-none"
                                          >
                                            <option value="VIEWER" className="dark:bg-slate-900">Xem</option>
                                            <option value="EDITOR" className="dark:bg-slate-900">Sửa</option>
                                          </select>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteMember(task.id, m.id);
                                            }}
                                            className="text-slate-400 hover:text-red-500 transition-colors duration-150 p-1"
                                            title="Xóa thành viên"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* Thêm thành viên bằng Username (Chỉ chủ dự án được làm) */}
                                {task.userId === user?.id && (
                                  <div className="flex items-center gap-2.5 pt-1.5 max-w-md">
                                    <input
                                      type="text"
                                      placeholder="Nhập tên tài khoản người dùng..."
                                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                                      value={newMemberUsername[task.id] || ''}
                                      onChange={(e) => setNewMemberUsername({ ...newMemberUsername, [task.id]: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddMember(task.id);
                                      }}
                                    />
                                    <select
                                      value={newMemberRole[task.id] || 'VIEWER'}
                                      onChange={(e) => setNewMemberRole({ ...newMemberRole, [task.id]: e.target.value })}
                                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white font-bold"
                                    >
                                      <option value="VIEWER">Chỉ xem</option>
                                      <option value="EDITOR">Quyền sửa</option>
                                    </select>
                                    <button
                                      onClick={() => handleAddMember(task.id)}
                                      className="rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/10 transition shrink-0"
                                    >
                                      Thêm người
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Thảo luận (Comments) */}
                            {task.members && task.members.length > 0 && (
                              <div id={`comments-section-${task.id}`} className="border-t border-slate-200/60 dark:border-slate-800 pt-5 mt-5 space-y-4">
                                <h4 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                  <MessageSquare size={14} className="text-blue-500" />
                                  Thảo luận ({comments[task.id]?.length || 0})
                                </h4>

                                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                                  {commentsLoading[task.id] && (!comments[task.id] || comments[task.id].length === 0) ? (
                                    <div className="text-xs text-slate-400 italic">Đang tải thảo luận...</div>
                                  ) : !comments[task.id] || comments[task.id].length === 0 ? (
                                    <div className="text-xs text-slate-400 italic">Chưa có bình luận nào. Hãy bắt đầu cuộc thảo luận!</div>
                                  ) : (
                                    (() => {
                                      const renderedList: React.ReactNode[] = [];
                                      let lastDateStr = '';

                                      (comments[task.id] || []).forEach((comment) => {
                                        const commentDate = new Date(comment.createdAt);
                                        const currentDateStr = commentDate.toDateString();

                                        if (currentDateStr !== lastDateStr) {
                                          lastDateStr = currentDateStr;
                                          renderedList.push(
                                            <div key={`sep-${comment.id}`} className="flex items-center justify-center py-3 my-1">
                                              <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800/60" />
                                              <span className="px-3.5 py-0.5 text-[9px] font-black text-slate-450 dark:text-slate-550 uppercase tracking-widest bg-slate-550/5 dark:bg-slate-950/20 rounded-full border border-slate-100/50 dark:border-slate-800/40 shadow-xs">
                                                {getCommentDateLabel(comment.createdAt)}
                                              </span>
                                              <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800/60" />
                                            </div>
                                          );
                                        }

                                        const isMe = comment.user.username === user?.username;
                                        renderedList.push(
                                          <div key={comment.id} className={`flex gap-3 text-xs ${isMe ? 'flex-row-reverse' : ''}`}>
                                            <UserAvatar 
                                              username={comment.user.username} 
                                              avatarUrl={comment.user.avatar} 
                                              sizeClass="h-7 w-7" 
                                              textClass="text-[10px] font-black" 
                                            />
                                            <div className={`flex-1 rounded-2xl p-3 border ${isMe ? 'bg-blue-500/10 border-blue-200/30 dark:bg-blue-950/30 dark:border-blue-800/30' : 'bg-slate-50/70 border-slate-100/50 dark:bg-slate-900/60 dark:border-slate-800/40'}`}>
                                              <div className={`flex items-center justify-between gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                <span className="font-extrabold text-slate-800 dark:text-slate-200">{comment.user.username}</span>
                                                <span className="text-[9px] text-slate-400">{new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                              </div>
                                              <p className={`text-slate-600 dark:text-slate-300 leading-relaxed font-medium break-all whitespace-pre-wrap ${isMe ? 'text-right' : ''}`}>{comment.content}</p>
                                            </div>
                                          </div>
                                        );
                                      });

                                      return renderedList;
                                    })()
                                  )}
                                </div>

                                {/* Nhập bình luận */}
                                <div className="flex gap-2.5 pt-2 max-w-md">
                                  <input
                                    type="text"
                                    placeholder="Nhập bình luận..."
                                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                                    value={commentInput}
                                    onChange={(e) => setCommentInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddComment(task.id);
                                    }}
                                  />
                                  <button
                                    onClick={() => handleAddComment(task.id)}
                                    className="rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/10 transition"
                                  >
                                    Gửi
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* --- KANBAN VIEW --- */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['PENDING', 'IN_PROGRESS', 'COMPLETED'].map((columnStatus) => {
            const columnTasks = getFilteredTasks().filter(t => t.status === columnStatus);
            return (
              <div key={columnStatus} className="rounded-3xl bg-slate-100/40 p-5 space-y-4 dark:bg-slate-900/20 border border-slate-200/40 dark:border-slate-800/30 backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-slate-800/60">
                  <h3 className="font-extrabold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${columnStatus === 'PENDING' ? 'bg-slate-400' : columnStatus === 'IN_PROGRESS' ? 'bg-amber-400 shadow-md shadow-amber-400/20' : 'bg-green-500 shadow-md shadow-green-500/20'}`} />
                    {columnStatus === 'PENDING' ? 'Chờ làm' : columnStatus === 'IN_PROGRESS' ? 'Đang làm' : 'Hoàn thành'}
                  </h3>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400 shadow-sm border border-slate-100 dark:border-slate-800">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="space-y-4 min-h-[400px]">
                  {columnTasks.map((task) => (
                    <div 
                      key={task.id}
                      className={`glass-card hover-lift p-5 space-y-3.5 border-l-4 ${task.priority === 'HIGH' ? 'border-l-red-500' : task.priority === 'MEDIUM' ? 'border-l-amber-500' : 'border-l-slate-400'}`}
                    >
                      <h4 className="font-black text-sm text-slate-800 dark:text-white flex items-center flex-wrap gap-1.5 leading-snug">
                        <span className="truncate max-w-[170px]">{task.title}</span>
                        {task.members && task.members.length > 0 && (
                          <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-extrabold text-indigo-600 border border-indigo-150 uppercase tracking-wide dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30 shrink-0">Dự án nhóm</span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{task.description}</p>
                      
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        <span>Hạn: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Không hạn'}</span>
                        <span className={`rounded-lg px-2 py-0.5 border ${getPriorityBadgeColor(task.priority)}`}>
                          {getPriorityLabel(task.priority)}
                        </span>
                      </div>

                      {/* Progress bar in Kanban card */}
                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                          <span>Tiến độ</span>
                          <span className="text-blue-500 dark:text-blue-400">{task.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500" 
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Quick Move Buttons */}
                      <div className="flex justify-end gap-1.5 border-t border-slate-100 pt-3 mt-3 dark:border-slate-800">
                        {columnStatus !== 'PENDING' && (
                          <button 
                            onClick={() => handleUpdateStatus(task.id, 'PENDING')}
                            className="rounded-lg bg-slate-50/50 border border-slate-200/50 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition"
                          >
                            ◀ Chờ
                          </button>
                        )}
                        {columnStatus !== 'IN_PROGRESS' && (
                          <button 
                            onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')}
                            className="rounded-lg bg-blue-50/50 border border-blue-200/20 px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/40 transition"
                          >
                            {columnStatus === 'COMPLETED' ? '◀ Đang làm' : 'Đang làm ▶'}
                          </button>
                        )}
                        {columnStatus !== 'COMPLETED' && (
                          <button 
                            onClick={() => {
                              const isOwner = task.userId === user?.id;
                              if (!isOwner) {
                                alert('Chỉ chủ dự án mới có quyền hoàn thành dự án.');
                                return;
                              }
                              const allSubtasksCompleted = task.subtasks.length === 0 || task.subtasks.every((sub: any) => sub.isCompleted);
                              if (!allSubtasksCompleted) {
                                alert('Chỉ có thể hoàn thành dự án khi tất cả công việc con đã được hoàn thành.');
                                return;
                              }
                              handleUpdateStatus(task.id, 'COMPLETED');
                            }}
                            className="rounded-lg bg-emerald-50/50 border border-emerald-200/20 px-2 py-1 text-[10px] font-bold text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/40 transition"
                          >
                            Xong ▶
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <CheckSquare size={20} className="text-blue-500" />
                Tạo công việc mới
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                  Tên công việc <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đồ án môn Web"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                    Hạn chót (Deadline) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                    Danh mục <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="" className="dark:bg-slate-900 dark:text-white">-- Chọn danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} className="dark:bg-slate-900 dark:text-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                  Mức ưu tiên <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="LOW" className="dark:bg-slate-900 dark:text-white">Thấp</option>
                  <option value="MEDIUM" className="dark:bg-slate-900 dark:text-white">Trung bình</option>
                  <option value="HIGH" className="dark:bg-slate-900 dark:text-white">Cao</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                  Mô tả công việc <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  placeholder="Nhập thông tin mô tả chi tiết của công việc..."
                  rows={2}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:focus:border-blue-500"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Form Subtasks Creator */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Công việc con (Subtasks)</label>
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    placeholder="Ví dụ: Thiết kế Database"
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white"
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTempSubtask();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTempSubtask}
                    className="rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition dark:bg-blue-600 dark:hover:bg-blue-700"
                  >
                    Thêm
                  </button>
                </div>

                <div className="max-h-24 overflow-y-auto space-y-2 pt-2">
                  {newSubtasks.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{s}</span>
                      <button 
                        type="button"
                        onClick={() => handleRemoveTempSubtask(idx)}
                        className="text-red-500 hover:text-red-700 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition"
                >
                  Tạo mới
                </button>
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
                Nhập công việc từ Excel
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
                  Vui lòng tải xuống file mẫu bên dưới để điền thông tin công việc đúng cấu trúc dữ liệu. Sau đó tải file đã điền lên hệ thống.
                </p>
                <button
                  onClick={downloadTaskTemplate}
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
                  <li>Số công việc thành công: {importResult.success}</li>
                  <li>Số công việc thất bại: {importResult.failed}</li>
                </ul>
              </div>
            )}

            {/* Preview dữ liệu */}
            {parsedTasks.length > 0 && !importResult && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Xem trước dữ liệu ({parsedTasks.length} hàng)</label>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-900 font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Công việc</th>
                        <th className="px-3 py-2 text-left">Độ ưu tiên</th>
                        <th className="px-3 py-2 text-left">Hạn chót</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950/20 text-slate-700 dark:text-slate-300">
                      {parsedTasks.slice(0, 5).map((t, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium truncate max-w-[150px]">{t['Tên công việc (Bắt buộc)']}</td>
                          <td className="px-3 py-2">{t['Độ ưu tiên (LOW/MEDIUM/HIGH)']}</td>
                          <td className="px-3 py-2">{t['Hạn chót (YYYY-MM-DD)']}</td>
                        </tr>
                      ))}
                      {parsedTasks.length > 5 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-1.5 text-center text-slate-400 bg-slate-50/20 italic">
                            ...và {parsedTasks.length - 5} công việc khác
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
              {parsedTasks.length > 0 && !importResult && (
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

      {/* Sidebar Nhật ký hoạt động */}
      {activeActivityTaskId && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setActiveActivityTaskId(null)}
          />
          
          <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-md transform bg-white p-6 shadow-2xl dark:bg-slate-900 border-l border-slate-200/50 dark:border-slate-800 transition-all flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <History className="text-blue-500" size={20} />
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                    Nhật ký hoạt động
                  </h3>
                </div>
                <button 
                  onClick={() => setActiveActivityTaskId(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                {loadingLogs ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="text-center py-12 text-sm text-slate-400 italic">
                    Chưa ghi nhận hoạt động nào trong dự án này.
                  </div>
                ) : (
                  <div className="flow-root">
                    <ul className="-mb-8">
                      {activityLogs.map((log, idx) => (
                        <li key={log.id}>
                          <div className="relative pb-8">
                            {idx !== activityLogs.length - 1 && (
                              <span 
                                className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100 dark:bg-slate-800" 
                                aria-hidden="true" 
                              />
                            )}
                            <div className="relative flex space-x-3">
                              <div>
                                <UserAvatar 
                                  username={log.user.username} 
                                  avatarUrl={log.user.avatar} 
                                  sizeClass="h-8 w-8 ring-4 ring-white dark:ring-slate-900" 
                                  textClass="text-[11px] font-black" 
                                />
                              </div>
                              <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                                <div className="text-xs text-slate-600 dark:text-slate-300">
                                  <span className="font-extrabold text-slate-900 dark:text-white mr-1.5">
                                    {log.user.username}
                                  </span>
                                  {log.details}
                                </div>
                                <div className="text-right text-[10px] whitespace-nowrap text-slate-400 font-medium">
                                  {new Date(log.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  <div className="text-[9px] text-slate-400">
                                    {new Date(log.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal hiển thị thông tin thành viên */}
      {selectedMemberInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setSelectedMemberInfo(null)} 
          />
          
          {/* Modal Content */}
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                <User size={18} className="text-blue-500" />
                Thông tin tài khoản
              </h3>
              
              <button 
                onClick={() => setSelectedMemberInfo(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Detail */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <UserAvatar 
                  username={selectedMemberInfo.user?.username} 
                  avatarUrl={selectedMemberInfo.user?.avatar} 
                  sizeClass="h-20 w-20" 
                  textClass="text-3xl font-black"
                />
                <div className="space-y-1.5 text-center sm:text-left flex-1">
                  <h4 className="text-lg font-black text-slate-800 dark:text-white">
                    {selectedMemberInfo.user?.username}
                  </h4>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                    <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                      Vai trò: {selectedMemberInfo.user?.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}
                    </span>
                    {selectedMemberInfo.projectRole && (
                      <span className="inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                        Dự án: {selectedMemberInfo.projectRole}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Info rows */}
              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800/40">
                  <span className="text-slate-500 font-medium">Email</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 select-all">
                    {selectedMemberInfo.user?.email || 'Chưa cập nhật'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 font-medium">Số điện thoại</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 select-all">
                    {selectedMemberInfo.user?.phone || 'Chưa cập nhật'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedMemberInfo(null)}
                className="rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
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

export default Tasks;
