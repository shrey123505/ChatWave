import { useState } from 'react';
import { auth } from '../../lib/firebase';
import { LogOut, Settings as SettingsIcon, MessageSquare } from 'lucide-react';
import SettingsModal from '../settings/SettingsModal';
import { useAuthStore } from '../../store/useAuthStore';

export default function ChatLayout() {
  const { user } = useAuthStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden text-text">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-surface/50 backdrop-blur-md">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <MessageSquare size={24} /> ChatWave
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-white/10 text-text-secondary transition-colors">
              <SettingsIcon size={20} />
            </button>
            <button onClick={() => auth.signOut()} className="p-2 rounded-full hover:bg-red-500/20 text-red-400 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-text-secondary opacity-50">
           <p>Your chats will appear here.</p>
           <p className="text-sm mt-2 text-center">Add friends by sharing your QR code from Settings.</p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background/50">
        <div className="flex-1 flex items-center justify-center text-text-secondary flex-col gap-4 p-8 text-center">
          <div className="w-24 h-24 rounded-full bg-surface/50 flex items-center justify-center border border-white/5 shadow-xl">
             <MessageSquare size={48} className="text-primary/50" />
          </div>
          <h3 className="text-2xl font-semibold">Welcome, {user?.displayName || 'User'}!</h3>
          <p className="max-w-md">Select a conversation or scan a QR code to start chatting. Swipe messages to reply, and click to add emojis.</p>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
