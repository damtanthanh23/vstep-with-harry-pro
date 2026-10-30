import React from 'react';
import { X, ZoomIn } from 'lucide-react';
import { StimulusCard } from '../types/exam';

interface ImageZoomModalProps {
  card: StimulusCard | null;
  onClose: () => void;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ card, onClose }) => {
  if (!card) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <ZoomIn className="h-5 w-5 text-sky-600" />
            <h3 className="text-lg font-semibold text-slate-900">
              {card.title || `Document ${card.id}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-inner font-sans space-y-4">
          {card.imageUrl && (
            <div className="text-center">
              <img
                src={card.imageUrl}
                alt={card.imageCaption || card.title || 'Exam visual'}
                className="mx-auto max-h-[60vh] w-auto rounded-xl border border-slate-200 bg-white object-contain shadow-sm"
              />
              {card.imageCaption && (
                <p className="mt-2 text-xs font-semibold text-slate-500 italic">
                  {card.imageCaption}
                </p>
              )}
            </div>
          )}
          {card.sender && (
            <div className="mb-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">From: </span>
              {card.sender}
            </div>
          )}
          {card.recipient && (
            <div className="mb-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">To: </span>
              {card.recipient}
            </div>
          )}
          {card.tag && (
            <div className="mb-3 inline-block rounded bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800">
              {card.tag}
            </div>
          )}
          {card.content && (
            <div className="whitespace-pre-line text-base leading-relaxed text-slate-800 font-medium">
              {card.content}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-[#58CC02] px-5 py-2 text-xs font-black text-white hover:bg-[#46a302] transition-colors cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
