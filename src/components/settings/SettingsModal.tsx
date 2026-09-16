import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Check, Trash2, AlertTriangle, Crown } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { isAdmin } from '../../utils/admin';
import DeleteAccountModal from './DeleteAccountModal';

const themes = [
  { id: 'theme-default', name: 'Violet (Default)', color: 'bg-violet-500' },
  { id: 'theme-blue', name: 'Ocean Blue', color: 'bg-blue-500' },
  { id: 'theme-rose', name: 'Rose', color: 'bg-rose-500' },
  { id: 'theme-emerald', name: 'Emerald', color: 'bg-emerald-500' },
];

export default function SettingsModal({ 
  onClose,
  onOpenAdmin
}: { 
  onClose: () => void;
  onOpenAdmin?: () => void;
}) {
  const { theme, setTheme, user, userProfile } = useAuthStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const profileUrl = window.location.origin + '?user=' + user?.uid;
  const isUserAdmin = isAdmin(userProfile, user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-surface/50 text-text">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-text">
          {/* Admin Command Center Quick Access */}
          {isUserAdmin && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent space-y-3 shadow-lg shadow-amber-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Crown size={18} className="fill-amber-400/20" />
                  <span>Platform Administration</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  OWNER
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                You have master administrator privileges. Open the Command Center to manage users, ban/delete accounts, and send broadcasts.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenAdmin?.();
                }}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-98 shadow-md shadow-amber-500/20"
              >
                <Crown size={15} /> Open Admin Command Center
              </button>
            </div>
          )}

          {/* QR Code Section */}
          <div className="flex flex-col items-center text-center space-y-4">
            <h3 className="text-lg font-medium text-text-secondary">Scan to Chat</h3>
            <div className="p-4 bg-white rounded-xl shadow-lg">
              <QRCodeSVG value={profileUrl} size={180} fgColor="#000" bgColor="#fff" />
            </div>
            <p className="text-sm text-text-secondary max-w-xs">
              Let your friends scan this QR code with their camera to instantly start a chat with you on ChatWave.
            </p>
          </div>

          <hr className="border-white/10" />

          {/* Theme Settings */}
          <div>
            <h3 className="text-lg font-medium text-text-secondary mb-4">Appearance</h3>
            <div className="grid grid-cols-2 gap-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${theme === t.id ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/30 bg-surface'}`}
                >
                  <div className={`w-6 h-6 rounded-full ${t.color} flex items-center justify-center`}>
                    {theme === t.id && <Check size={14} className="text-white" />}
                  </div>
                  <span className="text-sm font-medium">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-white/10" />

          {/* Danger Zone: Account Deletion */}
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
              <AlertTriangle size={16} />
              <span>Danger Zone</span>
            </div>
            <p className="text-xs text-text-secondary">
              Permanently delete your account, your profile data, and personal stories.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <Trash2 size={14} /> Delete Account
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => {
            setShowDeleteModal(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}
