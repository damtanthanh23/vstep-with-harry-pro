import React, { useState } from 'react';
import { X, Check, Compass, FileText, Tag, Layers } from 'lucide-react';
import {
  UserVocabFolder,
  EMOJI_ICON_OPTIONS,
  VocabDeckCategoryType,
  OFFICIAL_15_TOPICS,
} from '../../../types/vocab';
import { TestMetadata } from '../../../types/exam';

interface VocabDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deck: {
    name: string;
    description: string;
    icon: string;
    folderId?: string;
    categoryType?: VocabDeckCategoryType;
    officialTopicCode?: string;
    linkedTestId?: string;
    linkedTestTitle?: string;
    customTopicTag?: string;
  }) => void;
  folders: UserVocabFolder[];
  tests?: TestMetadata[];
  initialData?: {
    name?: string;
    description?: string;
    icon?: string;
    folderId?: string;
  };
}

export const VocabDeckModal: React.FC<VocabDeckModalProps> = ({
  isOpen,
  onClose,
  onSave,
  folders,
  tests = [],
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [selectedIcon, setSelectedIcon] = useState(initialData?.icon || '📚');
  const [folderId, setFolderId] = useState(initialData?.folderId || '');
  const [categoryType, setCategoryType] = useState<VocabDeckCategoryType>('custom_topic');
  const [officialTopicCode, setOfficialTopicCode] = useState<string>(OFFICIAL_15_TOPICS[0]);
  const [linkedTestId, setLinkedTestId] = useState<string>(tests[0]?.id || '');
  const [customTopicTag, setCustomTopicTag] = useState<string>('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên bộ từ vựng');
      return;
    }

    const selectedTest = tests.find((t) => t.id === linkedTestId);

    onSave({
      name: name.trim(),
      description: description.trim(),
      icon: selectedIcon,
      folderId: folderId || undefined,
      categoryType,
      officialTopicCode: categoryType === '15_topics' ? officialTopicCode : undefined,
      linkedTestId: categoryType === 'exam_test' ? linkedTestId || undefined : undefined,
      linkedTestTitle: categoryType === 'exam_test' ? selectedTest?.title : undefined,
      customTopicTag:
        categoryType === 'custom_topic' ? customTopicTag.trim() || name.trim() : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 rounded-xl bg-primary-100 dark:bg-primary-950/50">
              {selectedIcon}
            </span>
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {initialData ? 'Chỉnh sửa bộ từ vựng' : 'Tạo bộ từ vựng mới'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chọn mối liên kết (15 chủ đề B1, Đề thi, Chủ đề riêng hoặc Không gắn tag)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Chọn biểu tượng hiển thị
            </label>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedIcon(emoji)}
                  className={`h-10 flex items-center justify-center text-lg rounded-xl border transition-all ${
                    selectedIcon === emoji
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/50 scale-105 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Deck Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Tên bộ từ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="VD: Từ vựng Listening Part 2 - Đề 04"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              autoFocus
            />
          </div>

          {/* Relationship Category Selector */}
          <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Phân loại & Gắn nhãn liên kết
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCategoryType('custom_topic')}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition-all ${
                  categoryType === 'custom_topic'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Tag className="w-4 h-4 text-purple-500 shrink-0" />
                <span>Chủ đề tự tạo</span>
              </button>

              <button
                type="button"
                onClick={() => setCategoryType('exam_test')}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition-all ${
                  categoryType === 'exam_test'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                }`}
              >
                <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Gắn vào Đề thi</span>
              </button>

              <button
                type="button"
                onClick={() => setCategoryType('15_topics')}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition-all ${
                  categoryType === '15_topics'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Compass className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>15 Chủ đề B1</span>
              </button>

              <button
                type="button"
                onClick={() => setCategoryType('untagged')}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition-all ${
                  categoryType === 'untagged'
                    ? 'border-slate-600 bg-slate-200/70 dark:bg-slate-700 text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Layers className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Không gắn tag</span>
              </button>
            </div>

            {categoryType === 'exam_test' && (
              <div className="pt-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Chọn đề thi trong hệ thống:
                </label>
                <select
                  value={linkedTestId}
                  onChange={(e) => setLinkedTestId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100"
                >
                  <option value="">-- Chọn đề thi --</option>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {categoryType === '15_topics' && (
              <div className="pt-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Chọn 1 trong 15 chủ đề chuẩn B1:
                </label>
                <select
                  value={officialTopicCode}
                  onChange={(e) => setOfficialTopicCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100"
                >
                  {OFFICIAL_15_TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {categoryType === 'custom_topic' && (
              <div className="pt-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Nhãn chủ đề riêng (Tùy chọn):
                </label>
                <input
                  type="text"
                  value={customTopicTag}
                  onChange={(e) => setCustomTopicTag(e.target.value)}
                  placeholder="VD: Cụm động từ B1, Từ vựng hay sai..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Mô tả ngắn (tùy chọn)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Tổng hợp từ vựng trọng tâm từ bài đọc & transcript nghe"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          {/* Folder Select */}
          {folders.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Lưu vào thư mục (Tùy chọn)
              </label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="">-- Không xếp vào thư mục --</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-sm transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {initialData ? 'Lưu thay đổi' : 'Tạo bộ từ ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
