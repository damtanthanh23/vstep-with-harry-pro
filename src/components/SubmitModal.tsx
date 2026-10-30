import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface SubmitModalProps {
  isOpen: boolean;
  timeRemainingSeconds: number;
  onContinue: () => void;
  onSubmit: () => void;
}

export const SubmitModal: React.FC<SubmitModalProps> = ({
  isOpen,
  timeRemainingSeconds,
  onContinue,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const minutes = Math.floor(timeRemainingSeconds / 60);
  const seconds = timeRemainingSeconds % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        {/* Warning Icon Badge */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500 shadow-inner">
          <AlertTriangle className="h-9 w-9" />
        </div>

        {/* Message */}
        <h3 className="mb-2 text-xl font-bold text-slate-900">
          You have {minutes}m {seconds.toString().padStart(2, '0')}s to complete the test
        </h3>
        <p className="mb-6 text-sm text-slate-500">
          Would you like to submit now?
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 rounded-xl border-2 border-sky-500 bg-white py-2.5 px-4 text-sm font-semibold text-sky-600 hover:bg-sky-50 transition-colors"
          >
            Continue the test
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="flex-1 rounded-xl bg-rose-500 py-2.5 px-4 text-sm font-semibold text-white shadow-md hover:bg-rose-600 transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};
