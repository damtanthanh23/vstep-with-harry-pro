import React, { useState, useRef, useId, useEffect } from 'react';
import {
  Upload,
  Link as LinkIcon,
  Clipboard,
  Trash2,
  Maximize2,
  X,
  Image as ImageIcon,
  Check,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface ImageUploaderCardProps {
  label?: string;
  subLabel?: string;
  imageUrl?: string;
  caption?: string;
  onImageChange: (url: string) => void;
  onCaptionChange?: (caption: string) => void;
  compact?: boolean;
}

/**
 * Compress and resize image client-side with adaptive quality so base64 strings
 * stay crisp for reading exam notices (~25-55KB) and never exceed Firestore's 1 MiB document limit.
 */
const compressImageToDataUrl = (
  file: File,
  maxDimension = 850,
  initialQuality = 0.76
): Promise<{ dataUrl: string; sizeKb: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh từ thiết bị.'));
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        reject(new Error('Dữ liệu tệp ảnh trống.'));
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onerror = () => {
        // Fallback to raw data URL if browser cannot decode into canvas (e.g. SVG/HEIC)
        const approxKb = Math.max(1, Math.round((rawDataUrl.length * 3) / 4 / 1024));
        resolve({ dataUrl: rawDataUrl, sizeKb: approxKb });
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          if (!width || !height) {
            width = 800;
            height = 600;
          }
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.max(1, Math.round((height * maxDimension) / width));
              width = maxDimension;
            } else {
              width = Math.max(1, Math.round((width * maxDimension) / height));
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            const approxKb = Math.max(1, Math.round((rawDataUrl.length * 3) / 4 / 1024));
            resolve({ dataUrl: rawDataUrl, sizeKb: approxKb });
            return;
          }

          // Fill white background for transparent PNG notices/tickets
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          let quality = initialQuality;
          let compressed = canvas.toDataURL('image/webp', quality);
          if (!compressed.startsWith('data:image/webp')) {
            compressed = canvas.toDataURL('image/jpeg', quality);
          }

          // Adaptive step-down if image is still > 75KB so multiple images fit easily in Firestore
          while (compressed.length > 100000 && quality > 0.45) {
            quality -= 0.1;
            compressed = canvas.toDataURL('image/jpeg', quality);
          }

          const approxKb = Math.max(1, Math.round((compressed.length * 3) / 4 / 1024));
          resolve({ dataUrl: compressed, sizeKb: approxKb });
        } catch {
          const approxKb = Math.max(1, Math.round((rawDataUrl.length * 3) / 4 / 1024));
          resolve({ dataUrl: rawDataUrl, sizeKb: approxKb });
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
};

export const ImageUploaderCard: React.FC<ImageUploaderCardProps> = ({
  label = 'Hình ảnh đề thi / Thông báo / Biển báo',
  subLabel = 'Hỗ trợ tải tệp từ máy, dán trực tiếp (Ctrl + V) hoặc nhập URL',
  imageUrl,
  caption,
  onImageChange,
  onCaptionChange,
}) => {
  const uniqueId = useId();
  const fileInputId = `img-upload-${uniqueId}`;

  const [activeMode, setActiveMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState(imageUrl && imageUrl.startsWith('http') ? imageUrl : '');
  const [isDragging, setIsDragging] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [pasteNotice, setPasteNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [imgLoadError, setImgLoadError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgLoadError(false);
    if (imageUrl && imageUrl.startsWith('http')) {
      setUrlInput(imageUrl);
    }
  }, [imageUrl]);

  const showFeedback = (text: string, isError = false) => {
    setPasteNotice({ text, isError });
    setTimeout(() => setPasteNotice(null), 4000);
  };

  // Validate and process any selected or pasted image file
  const processFile = async (file: File) => {
    const isImageMime = file.type && file.type.startsWith('image/');
    const isImageExt = /\.(png|jpe?g|webp|gif|bmp|svg|avif|heic)$/i.test(file.name || '');

    if (!isImageMime && !isImageExt) {
      showFeedback('Vui lòng chọn đúng tệp hình ảnh (.png, .jpg, .jpeg, .webp, .gif)', true);
      return;
    }

    setIsCompressing(true);
    setImgLoadError(false);
    try {
      const { dataUrl, sizeKb } = await compressImageToDataUrl(file);
      onImageChange(dataUrl);
      showFeedback(`Đã tải & tối ưu ảnh thành công (${sizeKb} KB)!`);
    } catch (err) {
      console.error('Image processing error:', err);
      showFeedback('Không thể xử lý tệp ảnh này, vui lòng thử ảnh khác.', true);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Always reset input value so selecting the same file again fires onChange
    e.target.value = '';
  };

  const triggerFilePicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Clipboard Paste handler (Ctrl + V)
  const handlePasteEvent = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          e.stopPropagation();
          processFile(file);
          return;
        }
      }
    }
  };

  // Clipboard button handler via navigator.clipboard
  const handleClipboardClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageTypes = item.types.filter((t) => t.startsWith('image/'));
          if (imageTypes.length > 0) {
            const blob = await item.getType(imageTypes[0]);
            const file = new File([blob], 'clipboard-image.png', { type: imageTypes[0] });
            await processFile(file);
            return;
          }
        }
        showFeedback('Bộ nhớ tạm hiện chưa có ảnh. Hãy chụp màn hình rồi nhấn Ctrl + V!', true);
      } else {
        dropZoneRef.current?.focus();
        showFeedback('Đã chọn khung! Hãy nhấn tổ hợp phím Ctrl + V để dán ảnh.');
      }
    } catch {
      dropZoneRef.current?.focus();
      showFeedback('Hãy click vào khung này rồi nhấn phím Ctrl + V trên bàn phím để dán ảnh!');
    }
  };

  const handleApplyUrl = (rawUrl?: string) => {
    const target = (rawUrl !== undefined ? rawUrl : urlInput).trim();
    if (!target) return;
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('data:image/')) {
      setImgLoadError(false);
      onImageChange(target);
      showFeedback('Đã gắn đường dẫn ảnh thành công!');
    } else {
      showFeedback('Đường dẫn ảnh phải bắt đầu bằng https:// hoặc http://', true);
    }
  };

  const handleClearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImageChange('');
    setUrlInput('');
    setImgLoadError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sampleImages = [
    {
      name: 'Vé xem phim',
      url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Biển thư viện',
      url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Lịch tàu hỏa',
      url: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=600&auto=format&fit=crop&q=80',
    },
  ];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onPaste={handlePasteEvent}
      className="rounded-2xl border-2 border-slate-200 bg-white p-3.5 sm:p-4 text-slate-800 transition-all hover:border-lime-400"
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4 text-[#58CC02]" />
            <span>{label}</span>
          </label>
          {subLabel && <p className="text-[11px] font-medium text-slate-500">{subLabel}</p>}
        </div>

        {/* Toggle Mode: Upload vs URL */}
        <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs font-bold">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMode('upload');
            }}
            className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
              activeMode === 'upload'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tải / Dán ảnh
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMode('url');
            }}
            className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
              activeMode === 'url'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Link URL
          </button>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        id={fileInputId}
        ref={fileInputRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.avif"
        onChange={handleFileInputChange}
        className="sr-only"
      />

      {/* If Image exists: Show Image Preview Card with Replace, Zoom & Delete buttons */}
      {imageUrl ? (
        <div className="space-y-3">
          <div className="relative group overflow-hidden rounded-2xl border-2 border-[#58CC02] bg-slate-50 p-2.5 text-center">
            {!imgLoadError ? (
              <img
                src={imageUrl}
                alt="Hình minh họa đề thi LanguageCert"
                onError={() => setImgLoadError(true)}
                onClick={() => setIsZoomOpen(true)}
                className="mx-auto max-h-56 w-auto rounded-xl object-contain shadow-xs cursor-zoom-in transition-transform duration-200 group-hover:scale-[1.01]"
              />
            ) : (
              <div className="py-6 px-4 text-center space-y-2">
                <AlertCircle className="h-7 w-7 text-rose-500 mx-auto" />
                <div className="text-xs font-bold text-rose-700">
                  Không thể tải hình ảnh từ đường dẫn này. Vui lòng chọn tệp ảnh trực tiếp từ máy tính.
                </div>
              </div>
            )}

            {/* Quick Actions overlay */}
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={triggerFilePicker}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:border-[#58CC02] hover:text-[#46a302] transition-all cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Đổi ảnh khác</span>
              </button>

              {!imgLoadError && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsZoomOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-[#58CC02] hover:text-white transition-all cursor-pointer"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Phóng to</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleClearImage}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 shadow-2xs hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa ảnh</span>
              </button>
            </div>

            {!imgLoadError && (
              <div className="mt-2 flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                <span>Đã gắn ảnh thành công (Nhớ bấm Lưu Đề Thi ở góc trên cùng để lưu vĩnh viễn)</span>
              </div>
            )}
          </div>

          {/* Optional Caption */}
          {onCaptionChange && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Chú thích / Tiêu đề ảnh (tùy chọn):
              </label>
              <input
                type="text"
                value={caption || ''}
                onChange={(e) => onCaptionChange(e.target.value)}
                placeholder="VD: Public Notice, Cinema Ticket, Bus Timetable..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 outline-hidden focus:border-[#58CC02] focus:bg-white"
              />
            </div>
          )}
        </div>
      ) : (
        /* Empty State: Upload / Paste / URL Zone */
        <div className="space-y-3">
          {activeMode === 'upload' ? (
            <div
              ref={dropZoneRef}
              tabIndex={0}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFilePicker}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-all cursor-pointer outline-none ${
                isDragging
                  ? 'border-[#58CC02] bg-lime-50 ring-4 ring-lime-100'
                  : 'border-slate-300 bg-slate-50/70 hover:border-[#58CC02] hover:bg-lime-50/30 focus:border-[#58CC02] focus:ring-2 focus:ring-lime-100'
              }`}
            >
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-100 text-[#46a302]">
                <Upload className="h-5 w-5" />
              </div>

              <div className="text-xs font-bold text-slate-800">
                {isCompressing ? (
                  <span className="text-[#46a302]">Đang nén & tối ưu dung lượng ảnh...</span>
                ) : (
                  <>
                    Kéo thả ảnh vào đây, hoặc{' '}
                    <span className="text-[#46a302] underline font-black">
                      bấm chọn ảnh từ máy tính
                    </span>
                  </>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500">
                <span className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 font-bold font-mono text-slate-700 shadow-2xs">
                  Ctrl + V
                </span>
                <span>Dán ảnh chụp màn hình trực tiếp (tự động nén nhẹ chuẩn Cloud)</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={triggerFilePicker}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#58CC02] hover:bg-[#46a302] px-3.5 py-1.5 text-xs font-black text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Chọn file ảnh</span>
                </button>

                <button
                  type="button"
                  onClick={handleClipboardClick}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-lime-300 bg-white px-3 py-1.5 text-xs font-bold text-[#46a302] shadow-2xs hover:bg-lime-50 transition-colors cursor-pointer"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  <span>Dán từ Clipboard</span>
                </button>
              </div>
            </div>
          ) : (
            /* URL Input Tab */
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyUrl();
                      }
                    }}
                    onBlur={() => {
                      if (urlInput.trim().startsWith('http')) {
                        handleApplyUrl();
                      }
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      if (pasted && pasted.trim().startsWith('http')) {
                        setTimeout(() => handleApplyUrl(pasted.trim()), 50);
                      }
                    }}
                    placeholder="Dán đường dẫn ảnh (https://...) rồi nhấn Enter hoặc Gắn ảnh"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-2 text-xs font-medium text-slate-800 outline-hidden focus:border-[#58CC02] focus:bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyUrl()}
                  className="rounded-xl bg-[#58CC02] hover:bg-[#46a302] px-4 py-2 text-xs font-black text-white shadow-sm border-b-2 border-[#3c8c02] active:translate-y-0.5 transition-all cursor-pointer"
                >
                  Gắn ảnh
                </button>
              </div>

              {/* Sample Templates */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 flex-wrap">
                <span className="font-bold flex items-center gap-1 text-slate-600">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Mẫu nhanh:
                </span>
                {sampleImages.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUrlInput(s.url);
                      onImageChange(s.url);
                      showFeedback(`Đã áp dụng mẫu ${s.name}`);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:border-[#58CC02] hover:bg-lime-50 transition-colors cursor-pointer"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Notice Toast */}
      {pasteNotice && (
        <div
          className={`mt-2.5 rounded-xl border px-3 py-1.5 text-center text-xs font-bold flex items-center justify-center gap-1.5 ${
            pasteNotice.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-lime-100 border-lime-300 text-lime-900'
          }`}
        >
          {pasteNotice.isError ? (
            <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
          ) : (
            <Check className="h-3.5 w-3.5 text-lime-700 shrink-0" />
          )}
          <span>{pasteNotice.text}</span>
        </div>
      )}

      {/* Zoom Modal */}
      {isZoomOpen && imageUrl && (
        <div
          onClick={() => setIsZoomOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-3xl bg-white p-3 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setIsZoomOpen(false)}
              className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/80 text-white shadow-lg hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={imageUrl}
              alt="Phóng to"
              className="max-h-[80vh] w-auto rounded-2xl object-contain mx-auto"
            />
            {caption && (
              <div className="p-3 text-center text-xs font-bold text-slate-700">{caption}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
