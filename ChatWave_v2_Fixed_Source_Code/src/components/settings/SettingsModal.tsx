import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Check, Trash2, AlertTriangle, Crown, Palette, Copy, Share2, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { isAdmin } from '../../utils/admin';
import DeleteAccountModal from './DeleteAccountModal';
import toast from 'react-hot-toast';

const themes = [
  { id: 'theme-default', name: 'Cyber Violet', subtitle: 'Cosmic Indigo & Neon Purple', preview: 'from-violet-500 to-purple-400', bg: '#090d16' },
  { id: 'theme-aurora', name: 'Aurora Neon', subtitle: 'Midnight Teal & Cyan Glow', preview: 'from-cyan-400 to-emerald-400', bg: '#061014' },
  { id: 'theme-blue', name: 'Oceanic Sapphire', subtitle: 'Abyssal Navy & Sky Blue', preview: 'from-blue-500 to-sky-400', bg: '#070e1c' },
  { id: 'theme-rose', name: 'Sunset Crimson', subtitle: 'Deep Wine & Coral Rose', preview: 'from-rose-500 to-orange-400', bg: '#12080e' },
  { id: 'theme-emerald', name: 'Emerald Forest', subtitle: 'Dark Pine & Mint Lime', preview: 'from-emerald-500 to-lime-400', bg: '#06120e' },
  { id: 'theme-amoled', name: 'AMOLED Gold', subtitle: 'True Black & Luxe Amber', preview: 'from-amber-500 to-yellow-300', bg: '#000000' },
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

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(profileUrl);
    toast.success('Profile invite link copied!');
  };

  const handleShareProfile = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Chat with ${userProfile?.name || 'me'} on ChatWave`,
          text: `Connect with me on ChatWave!`,
          url: profileUrl,
        });
      } catch {}
    } else {
      handleCopyInviteLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="glass-panel w-full max-w-lg rounded-3xl overflow-hidden flex flex-col max-h-[90vh] border border-white/15 shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex justify-between items-center bg-black/25 text-text">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/15 text-primary border border-primary/25">
              <Palette size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold leading-tight">Appearance & Settings</h2>
              <p className="text-xs text-text-secondary">Personalize your ChatWave theme & share QR</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors text-text-secondary hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-text">
          {/* Admin Command Center Quick Access */}
          {isUserAdmin && (
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent space-y-3 shadow-lg shadow-amber-500/5">
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
                You have master administrator privileges. Open the Command Center to manage users, review reports, and send broadcasts.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenAdmin?.();
                }}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-amber-500/20"
              >
                <Crown size={15} /> Open Admin Command Center
              </button>
            </div>
          )}

          {/* Theme Studio */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <Sparkles size={14} className="text-primary" /> Theme Studio (6 Dynamic Themes)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {themes.map((t) => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id);
                      toast.success(`Applied ${t.name} theme`, { id: 'theme-toast', duration: 1500 });
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all active:scale-98 ${
                      isSelected 
                        ? 'border-primary bg-primary/15 shadow-lg shadow-primary/10 ring-1 ring-primary/40' 
                        : 'border-white/10 hover:border-white/25 bg-black/25 hover:bg-white/5'
                    }`}
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/20 shadow-inner relative overflow-hidden"
                      style={{ backgroundColor: t.bg }}
                    >
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${t.preview} flex items-center justify-center shadow`}>
                        {isSelected && <Check size={13} className="text-white stroke-[3]" />}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-text truncate">{t.name}</p>
                      <p className="text-[11px] text-text-secondary truncate">{t.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-white/10" />

          {/* QR Code & Direct Invite Section */}
          <div className="flex flex-col items-center text-center space-y-3 bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-text">Instant Connect QR Code</h3>
            <div className="p-3.5 bg-white rounded-2xl shadow-xl border-4 border-primary/30">
              <QRCodeSVG value={profileUrl} size={160} fgColor="#090d16" bgColor="#ffffff" />
            </div>
            <p className="text-xs text-text-secondary max-w-xs leading-relaxed">
              Friends can scan this QR code or open your invite link to connect with <span className="text-primary font-semibold">@{userProfile?.username || 'you'}</span>.
            </p>
            <div className="flex items-center gap-2 w-full max-w-xs pt-1">
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Copy size={14} className="text-primary" /> Copy Link
              </button>
              <button
                type="button"
                onClick={handleShareProfile}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow active:scale-95"
              >
                <Share2 size={14} /> Share Profile
              </button>
            </div>
          </div>

          <hr className="border-white/10" />

          {/* Danger Zone: Account Deletion */}
          <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
              <AlertTriangle size={16} />
              <span>Danger Zone</span>
            </div>
            <p className="text-xs text-text-secondary">
              Permanently delete your account, profile data, and active 24-hour stories.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
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
