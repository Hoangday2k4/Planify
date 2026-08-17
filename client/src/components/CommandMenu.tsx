import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Search, Calendar, CheckSquare, X, ArrowRight } from 'lucide-react';

interface SearchResult {
  events: Array<{
    id: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    color: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    progress: number;
  }>;
}

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandMenu: React.FC<CommandMenuProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ events: [], tasks: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input khi mở menu
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults({ events: [], tasks: [] });
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Gọi API tìm kiếm khi người dùng gõ
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!query.trim()) {
        setResults({ events: [], tasks: [] });
        return;
      }

      try {
        setLoading(true);
        const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
        setResults(res.data);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Lỗi tìm kiếm:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  // Click ra ngoài để đóng modal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Danh sách các kết quả phẳng để dễ di chuyển bằng phím Arrow
  const flatResults = [
    ...results.events.map(e => ({ type: 'event' as const, ...e })),
    ...results.tasks.map(t => ({ type: 'task' as const, ...t }))
  ];

  const handleSelect = (item: typeof flatResults[0]) => {
    onClose();
    if (item.type === 'event') {
      navigate('/calendar', { state: { openEventId: item.id } });
    } else {
      navigate('/tasks', { state: { openTaskId: item.id } });
    }
  };

  // Điều hướng bằng phím
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, flatResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + flatResults.length) % Math.max(1, flatResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[selectedIndex]) {
        handleSelect(flatResults[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/60 p-4 pt-[15vh] backdrop-blur-sm">
      <div 
        ref={modalRef}
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Search Input Area */}
        <div className="relative flex items-center border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
          <Search size={20} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Tìm kiếm lịch trình, công việc... (Ctrl+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ml-3 w-full bg-transparent text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none dark:text-white dark:placeholder-slate-500"
          />
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent shrink-0 ml-2" />
          ) : (
            <button 
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 ml-2"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Results Vùng */}
        <div className="max-h-[350px] overflow-y-auto p-2">
          {flatResults.length === 0 ? (
            <div className="py-12 text-center text-xs font-semibold text-slate-400">
              {query.trim() ? 'Không tìm thấy kết quả phù hợp.' : 'Nhập từ khóa để bắt đầu tìm kiếm...'}
            </div>
          ) : (
            <div className="space-y-1">
              {flatResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer transition ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {item.type === 'event' ? (
                        <Calendar size={18} className={isSelected ? 'text-white' : 'text-blue-500'} />
                      ) : (
                        <CheckSquare size={18} className={isSelected ? 'text-white' : 'text-emerald-500'} />
                      )}
                      <div className="min-w-0">
                        <span className="block text-sm font-extrabold truncate">
                          {item.title}
                        </span>
                        {item.description && (
                          <span className={`block text-xs truncate mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-black tracking-wider uppercase bg-white/20 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                        Đi tới <ArrowRight size={10} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Keyboard Shortcuts Helper Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[10px] font-bold text-slate-400 dark:border-slate-800 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex gap-4">
            <span>↑↓ để di chuyển</span>
            <span>↵ để chọn</span>
          </div>
          <span>Esc để đóng</span>
        </div>
      </div>
    </div>
  );
};

export default CommandMenu;
