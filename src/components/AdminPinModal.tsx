import React, { useState } from 'react';
import { Lock, X, KeyRound, AlertCircle, CheckCircle } from 'lucide-react';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default PIN: 2026 or 1234
    if (pin === '2026' || pin === '1234') {
      setError(false);
      sessionStorage.setItem('langcert_admin_unlocked', 'true');
      onSuccess();
      onClose();
    } else {
      setError(true);
    }
  };

  const handleDigitClick = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setError(false);
    }
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Xác thực Quản trị viên</h3>
              <p className="text-xs text-slate-500">Mã PIN dành riêng cho Giáo viên & Quản trị</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
          <strong>Lưu ý:</strong> Tài khoản Super Admin (<span className="font-semibold text-amber-900">damtanthanh23@gmail.com</span>) sẽ tự động mở khóa toàn quyền quản trị khi đăng nhập mà không cần nhập PIN.
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 text-center">
              Mã PIN Giáo viên (Mặc định: <span className="text-sky-600 font-mono font-bold">2026</span>)
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(false);
                }}
                placeholder="Nhập 4 số PIN"
                className={`w-full rounded-xl border py-3 text-center text-2xl font-mono tracking-widest outline-hidden transition-all ${
                  error
                    ? 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-300 bg-slate-50 text-slate-800 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100'
                }`}
                autoFocus
              />
              <KeyRound className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Mã PIN không chính xác. Vui lòng thử lại với mã 2026.</span>
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((item) => {
              if (item === 'C') {
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={handleClear}
                    className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                  >
                    Xóa
                  </button>
                );
              }
              if (item === 'OK') {
                return (
                  <button
                    key={item}
                    type="submit"
                    className="rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-sky-700 active:scale-95 transition-all"
                  >
                    Mở
                  </button>
                );
              }
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleDigitClick(item)}
                  className="rounded-xl border border-slate-200 bg-white py-2.5 text-base font-semibold text-slate-800 hover:bg-sky-50 hover:border-sky-300 active:scale-95 transition-all shadow-2xs font-mono"
                >
                  {item}
                </button>
              );
            })}
          </div>
        </form>
      </div>
    </div>
  );
};
