import { QRCodeSVG } from 'qrcode.react';
import { X, Check } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const themes = [
  { id: 'theme-default', name: 'Violet (Default)', color: 'bg-violet-500' },
  { id: 'theme-blue', name: 'Ocean Blue', color: 'bg-blue-500' },
  { id: 'theme-rose', name: 'Rose', color: 'bg-rose-500' },
  { id: 'theme-emerald', name: 'Emerald', color: 'bg-emerald-500' },
];

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { theme, setTheme, user } = useAuthStore();
  const profileUrl = window.location.origin + '?user=' + user?.uid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-surface/50 text-text">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 flex-1 text-text">
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
        </div>
      </div>
    </div>
  );
}
