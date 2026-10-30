import React, { useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  MailOpen,
  MessageSquareText,
} from 'lucide-react';
import {
  FeedbackReport,
  FeedbackStatus,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_META,
  updateFeedbackStatus,
  markAllFeedbacksAsRead,
  deleteFeedbackReport,
} from '../services/feedbackService';

interface AdminFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: FeedbackReport[];
}

export const AdminFeedbackModal: React.FC<AdminFeedbackModalProps> = ({
  isOpen,
  onClose,
  reports,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  if (!isOpen) return null;

  const counts = {
    all: reports.length,
    unread: reports.filter((r) => r.status === 'unread').length,
    read: reports.filter((r) => r.status === 'read').length,
    unresolved: reports.filter((r) => r.status === 'unresolved').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
  };

  const filteredReports =
    statusFilter === 'all'
      ? reports
      : reports.filter((r) => r.status === statusFilter);

  const formatDate = (ms: number) => {
    try {
      return new Date(ms).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const handleSaveAdminNote = async (report: FeedbackReport) => {
    await updateFeedbackStatus(report.id, report.status, noteDraft.trim());
    setEditingNoteId(null);
  };

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl bg-white p-6 sm:p-8 text-slate-900 shadow-2xl border-2 border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#58CC02] text-white shadow-sm border-b-3 border-[#3C8C02]">
              <Bell className="h-6 w-6" />
              {counts.unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-black text-white ring-2 ring-white tabular-nums">
                  {counts.unread}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Trung Tâm Thông Báo Báo Lỗi &amp; Góp Ý Học Viên
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Quản trị viên:{' '}
                <strong className="text-slate-800">
                  Mr.Harry (English Lecturer and Instructor)
                </strong>{' '}
                · Phân loại trạng thái xử lý theo thời gian thực
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {counts.unread > 0 && (
              <button
                type="button"
                onClick={() => markAllFeedbacksAsRead(reports)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-extrabold text-slate-700 transition-colors cursor-pointer"
              >
                <CheckCheck className="h-4 w-4 text-[#3C8C02]" />
                <span>Đánh dấu tất cả đã đọc ({counts.unread})</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 4 Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 py-4 border-b border-slate-100 shrink-0">
          {[
            { id: 'all' as const, label: 'Tất cả', count: counts.all },
            { id: 'unread' as const, label: 'Chưa đọc', count: counts.unread },
            { id: 'read' as const, label: 'Đã đọc', count: counts.read },
            { id: 'unresolved' as const, label: 'Chưa giải quyết', count: counts.unresolved },
            { id: 'resolved' as const, label: 'Đã giải quyết', count: counts.resolved },
          ].map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer ${
                  active
                    ? 'bg-[#58CC02] text-white shadow-xs border-b-2 border-[#3C8C02]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${
                    active ? 'bg-black/20 text-white' : 'bg-white text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Feedback Items List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
          {filteredReports.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <MessageSquareText className="h-7 w-7" />
              </div>
              <p className="text-sm font-extrabold text-slate-700">
                Chưa có thông báo báo lỗi hoặc góp ý nào trong mục này.
              </p>
              <p className="text-xs text-slate-400">
                Mọi góp ý từ học viên ở Landing Page, Phòng thi và Kết quả sẽ hiển thị tức thì tại đây.
              </p>
            </div>
          ) : (
            filteredReports.map((item) => {
              const statusMeta = FEEDBACK_STATUS_META[item.status] || FEEDBACK_STATUS_META.unread;
              const isEditingThisNote = editingNoteId === item.id;

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border-2 p-4 sm:p-5 transition-all ${
                    item.status === 'unread'
                      ? 'border-rose-300 bg-rose-50/25 shadow-sm'
                      : item.status === 'unresolved'
                      ? 'border-amber-300 bg-amber-50/20'
                      : item.status === 'resolved'
                      ? 'border-emerald-200 bg-emerald-50/15'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Top Row: Category + Context + Status Badge */}
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[11px] font-black ${statusMeta.badgeClass}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${statusMeta.dotClass}`} />
                          <span>{statusMeta.label}</span>
                        </span>

                        <span className="text-xs font-black text-slate-900">
                          {FEEDBACK_CATEGORY_LABELS[item.category] || 'Góp ý chung'}
                        </span>

                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(item.createdAt)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600">
                        Người gửi: <strong className="text-slate-900">{item.userName}</strong>
                        {item.userEmail && <span> ({item.userEmail})</span>}
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => deleteFeedbackReport(item.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Xóa thông báo này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Context Tag if attached to a specific test/question */}
                  {(item.testTitle || item.section || item.questionNumber) && (
                    <div className="mb-3 inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-[#3C8C02]" />
                      <span>
                        {[
                          item.testTitle,
                          item.section,
                          item.partNumber ? `Part ${item.partNumber}` : undefined,
                          item.questionNumber ? `Câu ${item.questionNumber}` : undefined,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  )}

                  {/* Message Body */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                    {item.message}
                  </div>

                  {/* Admin Resolution Note */}
                  {isEditingThisNote ? (
                    <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Ghi chú xử lý của Mr.Harry (VD: Đã cập nhật lại đáp án câu 4...)"
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#58CC02] focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveAdminNote(item)}
                          className="rounded-xl bg-[#58CC02] hover:bg-[#46A302] px-3.5 py-2 text-xs font-black text-white cursor-pointer"
                        >
                          Lưu ghi chú
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    item.adminNote && (
                      <div className="mt-2.5 rounded-xl bg-lime-50 border border-lime-200 px-3 py-2 text-xs text-lime-950">
                        <strong className="font-black">Ghi chú của Mr.Harry: </strong>
                        <span>{item.adminNote}</span>
                      </div>
                    )
                  )}

                  {/* Action Controls: Switch Status (Unread / Read / Unresolved / Resolved) */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400 mr-1">
                        Đổi trạng thái:
                      </span>

                      <button
                        type="button"
                        onClick={() => updateFeedbackStatus(item.id, 'unread')}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                          item.status === 'unread'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                        }`}
                      >
                        <MailOpen className="h-3 w-3" />
                        <span>Chưa đọc</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateFeedbackStatus(item.id, 'read')}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                          item.status === 'read'
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-700'
                        }`}
                      >
                        <Eye className="h-3 w-3" />
                        <span>Đã đọc</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateFeedbackStatus(item.id, 'unresolved')}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                          item.status === 'unresolved'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-800'
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        <span>Chưa giải quyết</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateFeedbackStatus(item.id, 'resolved')}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                          item.status === 'resolved'
                            ? 'bg-[#58CC02] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-lime-50 hover:text-[#3C8C02]'
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Đã giải quyết</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingNoteId(item.id);
                        setNoteDraft(item.adminNote || '');
                      }}
                      className="text-xs font-bold text-[#3C8C02] hover:underline cursor-pointer"
                    >
                      {item.adminNote ? 'Sửa ghi chú xử lý' : '+ Thêm ghi chú xử lý'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
