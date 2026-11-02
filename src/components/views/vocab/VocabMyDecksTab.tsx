import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderPlus,
  Plus,
  Sparkles,
  FileSpreadsheet,
  Search,
  Layers,
  Edit3,
  Trash2,
  ArrowRight,
  Bookmark,
  X,
  AlertTriangle,
} from 'lucide-react';
import { UserVocabDeck, UserVocabFolder } from '../../../types/vocab';
import { NormalizedVocabItem } from '../../../utils/vocabEngine';
import { UserVocabPartitionState } from '../../../services/vocabStorageService';

export interface VocabMyDecksTabProps {
  personalDecks: UserVocabDeck[];
  savedSystemDecks: UserVocabDeck[];
  folders: UserVocabFolder[];
  normalizedByDeckId: Record<string, NormalizedVocabItem[]>;
  vocabState: UserVocabPartitionState;
  onSelectDeck: (deckId: string) => void;
  onCreateDeck: (data: {
    title: string;
    description: string;
    folderId?: string;
    visibility?: 'private' | 'public';
  }) => void;
  onUpdateDeckMeta: (
    deckId: string,
    data: {
      title: string;
      description: string;
      folderId?: string;
      visibility?: 'private' | 'public';
    }
  ) => void;
  onDeleteDeck: (deckId: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onOpenAiModal: (deckId?: string) => void;
  onOpenQuickImport: (deckId?: string) => void;
  onOpenSrsForPersonalDecks: () => void;
}

export const VocabMyDecksTab: React.FC<VocabMyDecksTabProps> = ({
  personalDecks,
  savedSystemDecks,
  folders,
  normalizedByDeckId,
  vocabState,
  onSelectDeck,
  onCreateDeck,
  onUpdateDeckMeta,
  onDeleteDeck,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onOpenAiModal,
  onOpenQuickImport,
  onOpenSrsForPersonalDecks,
}) => {
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<'ALL' | 'UNCATEGORIZED' | string>(
    'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create / Edit Deck Modal
  const [deckModal, setDeckModal] = useState<{
    mode: 'create' | 'edit';
    deckId?: string;
    title: string;
    description: string;
    folderId: string;
    visibility: 'private' | 'public';
  } | null>(null);

  // Create / Rename Folder Modal
  const [folderModal, setFolderModal] = useState<{
    mode: 'create' | 'rename';
    folderId?: string;
    name: string;
  } | null>(null);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'deck'; id: string; title: string }
    | { type: 'folder'; id: string; title: string }
    | null
  >(null);

  const filteredPersonalDecks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return personalDecks.filter((d) => {
      if (selectedFolderFilter === 'UNCATEGORIZED') {
        if (d.folderId) return false;
      } else if (selectedFolderFilter !== 'ALL') {
        if (d.folderId !== selectedFolderFilter) return false;
      }
      if (q) {
        const deckTitle = d.title || d.name || '';
        return (
          deckTitle.toLowerCase().includes(q) ||
          (d.description || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [personalDecks, selectedFolderFilter, searchQuery]);

  const folderMap = useMemo(
    () => new Map<string, string>(folders.map((f) => [f.id, f.name])),
    [folders]
  );

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
            Bộ từ vựng & Thư mục cá nhân
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Tạo bộ từ riêng, phân loại theo thư mục, nhập CSV/JSON hoặc tạo từ vựng bằng AI
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenSrsForPersonalDecks}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition"
          >
            <Layers className="w-4 h-4" />
            Ôn ngắt quãng (SRS Bộ của tôi)
          </button>

          <button
            type="button"
            onClick={() =>
              setFolderModal({
                mode: 'create',
                name: '',
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
          >
            <FolderPlus className="w-4 h-4 text-amber-500" />
            + Thư mục
          </button>

          <button
            type="button"
            onClick={() => onOpenQuickImport()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Nhập CSV/JSON
          </button>

          <button
            type="button"
            onClick={() => onOpenAiModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition"
          >
            <Sparkles className="w-4 h-4" />
            Tạo từ AI
          </button>

          <button
            type="button"
            onClick={() =>
              setDeckModal({
                mode: 'create',
                title: '',
                description: '',
                folderId:
                  selectedFolderFilter !== 'ALL' && selectedFolderFilter !== 'UNCATEGORIZED'
                    ? selectedFolderFilter
                    : '',
                visibility: 'private',
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Tạo bộ từ mới
          </button>
        </div>
      </div>

      {/* Folder Tabs & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedFolderFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedFolderFilter === 'ALL'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({personalDecks.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedFolderFilter('UNCATEGORIZED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedFolderFilter === 'UNCATEGORIZED'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Chưa phân loại ({personalDecks.filter((d) => !d.folderId).length})
          </button>

          {folders.map((folder) => {
            const count = personalDecks.filter((d) => d.folderId === folder.id).length;
            const isSelected = selectedFolderFilter === folder.id;

            return (
              <div
                key={folder.id}
                className={`inline-flex items-center rounded-xl border text-xs font-bold transition ${
                  isSelected
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedFolderFilter(folder.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>
                    {folder.name} ({count})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFolderModal({
                      mode: 'rename',
                      folderId: folder.id,
                      name: folder.name,
                    })
                  }
                  className="px-1.5 py-1.5 opacity-75 hover:opacity-100"
                  title="Đổi tên thư mục"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({
                      type: 'folder',
                      id: folder.id,
                      title: folder.name,
                    })
                  }
                  className="pr-2 pl-1 py-1.5 opacity-75 hover:opacity-100"
                  title="Xóa thư mục (Các bộ từ sẽ chuyển về Chưa phân loại)"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm bộ từ của tôi..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Personal Decks Grid */}
      {filteredPersonalDecks.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <Folder className="w-10 h-10 text-slate-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-800">
              Chưa có bộ từ cá nhân nào trong mục này
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Hãy tạo bộ từ mới để tự thêm từ vựng, nhập từ Excel/CSV hoặc tạo từ vựng thông minh
              bằng AI.
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() =>
                setDeckModal({
                  mode: 'create',
                  title: '',
                  description: '',
                  folderId: '',
                  visibility: 'private',
                })
              }
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold"
            >
              <Plus className="w-4 h-4" />
              Tạo bộ từ đầu tiên
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPersonalDecks.map((deck) => {
            const items = normalizedByDeckId[deck.id] || [];
            const total = items.length;
            let known = 0;
            items.forEach((it) => {
              if (vocabState.knownMap[it.wordKey]?.isKnown) known++;
            });
            const percent = total === 0 ? 0 : Math.round((known / total) * 100);
            const folderName = deck.folderId ? folderMap.get(deck.folderId) : null;

            return (
              <div
                key={deck.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-indigo-300 transition flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                        <Folder className="w-3 h-3 text-amber-500" />
                        {folderName || 'Chưa phân loại'}
                      </span>
                      {deck.visibility === 'public' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          🌐 Cộng đồng
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setDeckModal({
                            mode: 'edit',
                            deckId: deck.id,
                            title: deck.title || deck.name || '',
                            description: deck.description || '',
                            folderId: deck.folderId || '',
                            visibility: deck.visibility === 'public' ? 'public' : 'private',
                          })
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Sửa tên / Chuyển thư mục / Chia sẻ Cộng đồng"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'deck',
                            id: deck.id,
                            title: deck.title || deck.name || 'Bộ từ',
                          })
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Xóa bộ từ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900">{deck.title || deck.name}</h3>
                  {deck.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{deck.description}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">
                        Đã thuộc: <strong className="text-slate-900">{known}/{total}</strong> từ
                      </span>
                      <span className="font-bold text-indigo-600">{percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectDeck(deck.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold transition"
                    >
                      <span>Học & Quản lý từ</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAiModal(deck.id)}
                      className="p-2.5 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700"
                      title="Thêm từ bằng AI vào bộ này"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Saved System Decks Section */}
      {savedSystemDecks.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-indigo-600 fill-indigo-600" />
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              Bộ từ hệ thống đã lưu ({savedSystemDecks.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedSystemDecks.map((deck) => {
              const items = normalizedByDeckId[deck.id] || [];
              const total = items.length;
              let known = 0;
              items.forEach((it) => {
                if (vocabState.knownMap[it.wordKey]?.isKnown) known++;
              });
              const percent = total === 0 ? 0 : Math.round((known / total) * 100);

              return (
                <div
                  key={deck.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between gap-4"
                >
                  <div>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold">
                      Bộ từ Hệ thống
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900 mt-1">{deck.title}</h4>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        Đã thuộc: <strong>{known}/{total}</strong> từ ({percent}%)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectDeck(deck.id)}
                      className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                    >
                      Vào học bộ từ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create / Edit Deck Modal */}
      {deckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                {deckModal.mode === 'create' ? 'Tạo bộ từ cá nhân mới' : 'Chỉnh sửa bộ từ'}
              </h3>
              <button
                type="button"
                onClick={() => setDeckModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên bộ từ vựng *
                </label>
                <input
                  type="text"
                  value={deckModal.title}
                  onChange={(e) =>
                    setDeckModal((prev) => (prev ? { ...prev, title: e.target.value } : null))
                  }
                  placeholder="Ví dụ: Từ vựng Reading Part 3..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả ngắn (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={deckModal.description}
                  onChange={(e) =>
                    setDeckModal((prev) =>
                      prev ? { ...prev, description: e.target.value } : null
                    )
                  }
                  placeholder="Ghi chú mục tiêu học tập..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Thuộc thư mục:
                </label>
                <select
                  value={deckModal.folderId}
                  onChange={(e) =>
                    setDeckModal((prev) => (prev ? { ...prev, folderId: e.target.value } : null))
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                >
                  <option value="">-- Chưa phân loại --</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quyền hiển thị & Chia sẻ Cloud:
                </label>
                <select
                  value={deckModal.visibility}
                  onChange={(e) =>
                    setDeckModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            visibility: e.target.value === 'public' ? 'public' : 'private',
                          }
                        : null
                    )
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                >
                  <option value="private">🔒 Cá nhân (Chỉ mình tôi & Giáo viên quản lý)</option>
                  <option value="public">🌐 Công khai lên Thư viện Cộng đồng Cloud</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeckModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!deckModal.title.trim()}
                onClick={() => {
                  if (!deckModal.title.trim()) return;
                  if (deckModal.mode === 'create') {
                    onCreateDeck({
                      title: deckModal.title.trim(),
                      description: deckModal.description.trim(),
                      folderId: deckModal.folderId || undefined,
                      visibility: deckModal.visibility,
                    });
                  } else if (deckModal.deckId) {
                    onUpdateDeckMeta(deckModal.deckId, {
                      title: deckModal.title.trim(),
                      description: deckModal.description.trim(),
                      folderId: deckModal.folderId || undefined,
                      visibility: deckModal.visibility,
                    });
                  }
                  setDeckModal(null);
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold"
              >
                Lưu bộ từ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Rename Folder Modal */}
      {folderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                {folderModal.mode === 'create' ? 'Tạo thư mục mới' : 'Đổi tên thư mục'}
              </h3>
              <button
                type="button"
                onClick={() => setFolderModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên thư mục *</label>
              <input
                type="text"
                value={folderModal.name}
                onChange={(e) =>
                  setFolderModal((prev) => (prev ? { ...prev, name: e.target.value } : null))
                }
                placeholder="Ví dụ: Ôn thi VSTEP B2..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFolderModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!folderModal.name.trim()}
                onClick={() => {
                  if (!folderModal.name.trim()) return;
                  if (folderModal.mode === 'create') {
                    onCreateFolder(folderModal.name.trim());
                  } else if (folderModal.folderId) {
                    onRenameFolder(folderModal.folderId, folderModal.name.trim());
                  }
                  setFolderModal(null);
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold"
              >
                Lưu thư mục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {deleteTarget.type === 'deck'
                    ? `Xóa bộ từ "${deleteTarget.title}"?`
                    : `Xóa thư mục "${deleteTarget.title}"?`}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  {deleteTarget.type === 'deck'
                    ? 'Bộ từ cá nhân này sẽ bị xóa khỏi danh sách của bạn.'
                    : 'Các bộ từ bên trong thư mục này sẽ KHÔNG bị xóa mà được chuyển về mục "Chưa phân loại".'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteTarget.type === 'deck') {
                    onDeleteDeck(deleteTarget.id);
                  } else {
                    if (selectedFolderFilter === deleteTarget.id) {
                      setSelectedFolderFilter('ALL');
                    }
                    onDeleteFolder(deleteTarget.id);
                  }
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
