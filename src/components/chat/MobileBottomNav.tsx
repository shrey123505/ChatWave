import { MessageSquare, Search, ScanLine, UserCircle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export type MobileTab = 'chats' | 'search' | 'profile';

export default function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenScanner
}: {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onOpenScanner: () => void;
}) {
  const { user, userProfile } = useAuthStore();
  const avatarUrl = userProfile?.photoURL || user?.photoURL;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-white/10 px-4 py-2 flex items-center justify-around text-xs shadow-2xl">
      {/* Chats Tab */}
      <button
        onClick={() => onTabChange('chats')}
        className={`flex flex-col items-center gap-1 p-1 transition-all ${
          activeTab === 'chats' ? 'text-primary scale-105 font-bold' : 'text-text-secondary hover:text-text'
        }`}
      >
        <MessageSquare size={22} className={activeTab === 'chats' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
        <span>Chats</span>
      </button>

      {/* Search Tab */}
      <button
        onClick={() => onTabChange('search')}
        className={`flex flex-col items-center gap-1 p-1 transition-all ${
          activeTab === 'search' ? 'text-primary scale-105 font-bold' : 'text-text-secondary hover:text-text'
        }`}
      >
        <Search size={22} className={activeTab === 'search' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
        <span>Search</span>
      </button>

      {/* QR Scanner Action */}
      <button
        onClick={onOpenScanner}
        className="flex flex-col items-center gap-1 p-1 text-text-secondary hover:text-text transition-all active:scale-95"
      >
        <div className="p-1.5 rounded-full bg-primary/20 text-primary">
          <ScanLine size={20} className="stroke-[2.2]" />
        </div>
        <span>Scan QR</span>
      </button>

      {/* Profile Tab */}
      <button
        onClick={() => onTabChange('profile')}
        className={`flex flex-col items-center gap-1 p-1 transition-all ${
          activeTab === 'profile' ? 'text-primary scale-105 font-bold' : 'text-text-secondary hover:text-text'
        }`}
      >
        {avatarUrl ? (
          <div className={`w-6 h-6 rounded-full overflow-hidden border ${activeTab === 'profile' ? 'border-primary ring-2 ring-primary/40' : 'border-white/20'}`}>
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          </div>
        ) : (
          <UserCircle size={22} className={activeTab === 'profile' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
        )}
        <span>Profile</span>
      </button>
    </div>
  );
}
