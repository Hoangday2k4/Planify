import * as XLSX from 'xlsx';

// Dữ liệu mẫu cho Lịch trình (Events)
const EVENT_TEMPLATE_DATA = [
  {
    'Tên sự kiện': 'Họp kế hoạch tuần',
    'Thời gian bắt đầu (YYYY-MM-DD HH:MM)': '2026-07-20 09:00',
    'Thời gian kết thúc (YYYY-MM-DD HH:MM)': '2026-07-20 10:30',
    'Địa điểm': 'Phòng họp A',
    'Danh mục': 'Họp hành',
    'Mức ưu tiên (LOW/MEDIUM/HIGH)': 'HIGH',
    'Bật nhắc nhở (Có/Không)': 'Có',
    'Thời gian nhắc nhở (phút trước)': 15,
    'Phương thức nhắc nhở (Web/Mail/Cả hai)': 'Cả hai',
    'Lặp lại (Không lặp lại/Mỗi ngày/Mỗi tuần/Mỗi tháng)': 'Mỗi tuần',
    'Mô tả': 'Thảo luận về tiến độ dự án mới và phân chia công việc'
  },
  {
    'Tên sự kiện': 'Chạy bộ buổi chiều',
    'Thời gian bắt đầu (YYYY-MM-DD HH:MM)': '2026-07-20 17:30',
    'Thời gian kết thúc (YYYY-MM-DD HH:MM)': '2026-07-20 18:30',
    'Địa điểm': 'Công viên Cầu Giấy',
    'Danh mục': 'Thể thao',
    'Mức ưu tiên (LOW/MEDIUM/HIGH)': 'LOW',
    'Bật nhắc nhở (Có/Không)': 'Không',
    'Thời gian nhắc nhở (phút trước)': '',
    'Phương thức nhắc nhở (Web/Mail/Cả hai)': '',
    'Lặp lại (Không lặp lại/Mỗi ngày/Mỗi tuần/Mỗi tháng)': 'Không lặp lại',
    'Mô tả': 'Chạy bộ nâng cao sức khỏe'
  }
];

// Dữ liệu mẫu cho Công việc (Tasks)
const TASK_TEMPLATE_DATA = [
  {
    'Tên công việc': 'Thiết kế giao diện Figma',
    'Hạn chót (YYYY-MM-DD)': '2026-07-25',
    'Danh mục': 'Học tập',
    'Mức ưu tiên (LOW/MEDIUM/HIGH)': 'HIGH',
    'Mô tả công việc': 'Hoàn thiện bản vẽ Wireframe và UI/UX cho các trang chính',
    'Công việc con (Subtasks)': 'Thiết kế trang chủ, Vẽ giao diện Kanban, Tạo bảng màu UI'
  },
  {
    'Tên công việc': 'Chuẩn bị tài liệu báo cáo',
    'Hạn chót (YYYY-MM-DD)': '2026-07-28',
    'Danh mục': 'Công việc',
    'Mức ưu tiên (LOW/MEDIUM/HIGH)': 'MEDIUM',
    'Mô tả công việc': 'Tổng hợp số liệu từ các thành viên trong nhóm',
    'Công việc con (Subtasks)': 'Thu thập số liệu nhóm FE, Thu thập số liệu nhóm BE, Soạn thảo word'
  }
];

// Xuất file mẫu Lịch trình
export const downloadEventTemplate = () => {
  const worksheet = XLSX.utils.json_to_sheet(EVENT_TEMPLATE_DATA);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Events Template');
  
  // Tự động điều chỉnh độ rộng cột
  const maxProps = [{ wch: 25 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 45 }, { wch: 40 }];
  worksheet['!cols'] = maxProps;

  XLSX.writeFile(workbook, 'planify_template_events.xlsx');
};

// Xuất file mẫu Công việc
export const downloadTaskTemplate = () => {
  const worksheet = XLSX.utils.json_to_sheet(TASK_TEMPLATE_DATA);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks Template');

  const maxProps = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 45 }, { wch: 55 }];
  worksheet['!cols'] = maxProps;

  XLSX.writeFile(workbook, 'planify_template_tasks.xlsx');
};

// Đọc và parse file Excel
export const parseExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
