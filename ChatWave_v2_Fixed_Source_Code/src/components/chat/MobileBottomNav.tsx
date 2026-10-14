import { MessageSquare, Search, ScanLine, UserCircle, Bell } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export type MobileTab = 'chats' | 'search' | 'profile';

export default function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenScanner,
  onOpenNotifications,
  unreadNotifCount = 0
}: {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onOpenScanner: () => void;
  onOpenNotifications?: () => void;
  unreadNotifCount?: number;
}) {
  const { user, userProfile } = useAuthStore();
  const avatarUrl = userProfile?.photoURL || user?.photoURL;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-2xl border-t border-white/10 px-2 pt-2 pb-safe flex items-center justify-around text-[11px] shadow-2xl">
      {/* Chats Tab */}
      <button
        onClick={() => onTabChange('chats')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
          activeTab === 'chats' ? 'text-primary font-bold bg-primary/10' : 'text-text-secondary hover:text-text'
        }`}
      >
        <MessageSquare size={20} className={activeTab === 'chats' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
        <span>Chats</span>
      </button>

      {/* Search Tab */}
      <button
        onClick={() => onTabChange('search')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
          activeTab === 'search' ? 'text-primary font-bold bg-primary/10' : 'text-text-secondary hover:text-text'
        }`}
      >
        <Search size={20} className={activeTab === 'search' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
        <span>Explore</span>
      </button>

      {/* Center Floating QR Scanner Action */}
      <button
        onClick={onOpenScanner}
        className="flex flex-col items-center gap-0.5 -mt-3 transition-all active:scale-95"
      >
        <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-primary to-secondary text-white shadow-lg shadow-primary/30 border border-white/20">
          <ScanLine size={20} className="stroke-[2.4]" />
        </div>
        <span className="text-[10px] font-semibold text-text-secondary">Scan QR</span>
      </button>

      {/* Alerts / Notifications Action */}
      {onOpenNotifications && (
        <button
          onClick={onOpenNotifications}
          className="relative flex flex-col items-center gap-1 py-1 px-3 rounded-2xl text-text-secondary hover:text-text transition-all active:scale-95"
        >
          <div className="relative">
            <Bell size={20} className="stroke-[1.8]" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse shadow">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </div>
          <span>Alerts</span>
        </button>
      )}

      {/* Profile Tab */}
      <button
        onClick={() => onTabChange('profile')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
          activeTab === 'profile' ? 'text-primary font-bold bg-primary/10' : 'text-text-secondary hover:text-text'
        }`}
      >
        {avatarUrl ? (
          <div className={`w-5 h-5 rounded-full overflow-hidden border ${activeTab === 'profile' ? 'border-primary ring-2 ring-primary/40' : 'border-white/20'}`}>
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          </div>
        ) : (
          <UserCircle size={20} className={activeTab === 'profile' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
        )}
        <span>Profile</span>
      </button>
    </div>
  );
}
