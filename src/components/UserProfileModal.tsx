import React, { useState, useEffect } from 'react';
import { X, User, Calendar, Phone, MapPin, Sparkles, Check, Smile } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getZodiacFromBirthDate } from './views/ZodiacPixelMascot';
import { getSavedNickname } from '../data/vietnameseStudyQuotes';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSaved?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileSaved,
}) => {
  const { currentUser, userProfile, updateUserProfileData } = useAuth();

  const [nickname, setNickname] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fallbackNick = getSavedNickname(
        currentUser?.uid,
        userProfile?.nickname || userProfile?.displayName || currentUser?.displayName || 'Học viên LanguageCert'
      );
      setNickname(userProfile?.nickname || fallbackNick || '');
      setDisplayName(userProfile?.displayName || currentUser?.displayName || '');
      setBirthDate(userProfile?.birthDate || '');
      setPhone(userProfile?.phone || '');
      setAddress(userProfile?.address || '');
      setSavedSuccess(false);
    }
  }, [isOpen, userProfile, currentUser]);

  if (!isOpen) return null;

  const previewZodiac = getZodiacFromBirthDate(birthDate);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const cleanNick = nickname.trim() || displayName.trim() || 'Học viên';
      await updateUserProfileData({
        nickname: cleanNick,
        displayName: displayName.trim() || cleanNick,
        birthDate: birthDate.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      setSavedSuccess(true);
      if (onProfileSaved) onProfileSaved();
      setTimeout(() => {
        onClose();
      }, 650);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#58CC02]/15 text-[#16A34A] dark:text-[#58CC02]">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Thông tin cá nhân
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Cập nhật hồ sơ, Nickname lời chào và ngày sinh linh vật 12 con giáp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nickname */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Nickname (Hiển thị ở câu chào)
              </label>
              <div className="relative">
                <Smile className="h-4 w-4 text-[#58CC02] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="VD: Harry, Minh Anh..."
                  maxLength={32}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:border-[#58CC02] focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Họ và tên đầy đủ
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nhập họ và tên..."
                  maxLength={50}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:border-[#58CC02] focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Birth Date */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Ngày tháng năm sinh
              </label>
              <div className="relative">
                <Calendar className="h-4 w-4 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:border-[#58CC02] focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden"
                />
              </div>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span>
                  Linh vật Bảng Mục Tiêu: {previewZodiac.branchName}
                  {!birthDate && ' (Mặc định)'}
                </span>
              </p>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Số điện thoại
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 text-sky-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0901234567"
                  maxLength={20}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:border-[#58CC02] focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Địa chỉ liên hệ
            </label>
            <div className="relative">
              <MapPin className="h-4 w-4 text-rose-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Nhập địa chỉ, trường học hoặc nơi công tác..."
                maxLength={120}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:border-[#58CC02] focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#58CC02] hover:bg-[#46A302] px-5 py-2.5 text-xs font-black text-white shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              {savedSuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Đã lưu hồ sơ!</span>
                </>
              ) : (
                <span>{isSaving ? 'Đang lưu...' : 'Lưu thông tin cá nhân'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
