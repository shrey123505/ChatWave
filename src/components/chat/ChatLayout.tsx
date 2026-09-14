import { useState, useEffect } from 'react';
import { auth } from '../../lib/firebase';
import { LogOut, Settings as SettingsIcon, MessageSquare, UserCircle, ScanLine } from 'lucide-react';
import SettingsModal from '../settings/SettingsModal';
import ProfileModal from '../profile/ProfileModal';
import QRScannerModal from '../settings/QRScannerModal';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../store/useAuthStore';
import { Toaster } from 'react-hot-toast';

export default function ChatLayout() {
  const { user } = useAuthStore();
  const [showSettings, setShowSettings] = useState(false);
  
  // States for viewing profiles vs actively chatting
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [viewingProfileUid, setViewingProfileUid] = useState<string | null>(null);
  
  const [showScanner, setShowScanner] = useState(false);
  const [activeChatUser, setActiveChatUser] = useState<any>(null);

  // Handle URL scanning
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const scannedUid = urlParams.get('user');
    if (scannedUid && user && scannedUid !== user.uid) {
      setViewingProfileUid(scannedUid);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [user]);

  return (
    <div className="flex h-screen bg-background overflow-hidden text-text">
      <Toaster position="top-center" />
      
      {/* Left Panel (Hidden on mobile if chat is active) */}
      <div className={`\${activeChatUser ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-white/10 flex-col bg-surface/50 backdrop-blur-md transition-all`}>
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <MessageSquare size={24} /> ChatWave
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setShowScanner(true)} className="p-2 rounded-full hover:bg-white/10 text-text-secondary transition-colors" title="Scan QR">
              <ScanLine size={20} />
            </button>
            <button onClick={() => setShowMyProfile(true)} className="p-2 rounded-full hover:bg-white/10 text-text-secondary transition-colors" title="My Profile">
              <UserCircle size={20} />
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-white/10 text-text-secondary transition-colors" title="Settings">
              <SettingsIcon size={20} />
            </button>
            <button onClick={() => auth.signOut()} className="p-2 rounded-full hover:bg-red-500/20 text-red-400 transition-colors" title="Logout">
              <LogOut size={20} />
            </button>
          </div>
        </div>
        
        {/* Search & Users List - Clicking now opens their profile! */}
        <Sidebar onSelectUser={(u) => setViewingProfileUid(u.uid)} />
      </div>

      {/* Main Chat Area (Hidden on mobile if NO chat is active) */}
      <div className={`\${!activeChatUser ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-background/50 relative transition-all`}>
        
        {/* Mobile Back Button & Chat Header */}
        {activeChatUser && (
          <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-surface/50 cursor-pointer" onClick={() => setViewingProfileUid(activeChatUser.uid)}>
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveChatUser(null); }} 
              className="md:hidden text-primary font-medium hover:bg-white/10 p-2 rounded-lg"
            >
              ← Back
            </button>
            <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden border border-white/10">
              {activeChatUser.photoURL ? (
                <img src={activeChatUser.photoURL} className="w-full h-full object-cover"/>
              ) : (
                <UserCircle className="w-full h-full text-primary" />
              )}
            </div>
            <div>
              <div className="font-bold">{activeChatUser.name}</div>
              <div className="text-xs text-text-secondary">Tap for profile info</div>
            </div>
          </div>
        )}

        {activeChatUser ? (
          <div className="flex-1 flex items-center justify-center flex-col text-text-secondary">
             <div className="w-24 h-24 rounded-full bg-surface/50 flex items-center justify-center border border-white/5 shadow-xl mb-4">
               <MessageSquare size={48} className="text-primary/50" />
             </div>
             <p className="max-w-md text-center">Chat interface with {activeChatUser.name} is ready for messaging logic.</p>
             <p className="mt-4 text-sm bg-primary/20 text-primary px-4 py-2 rounded-lg font-medium">Swipe to Reply & Emojis active soon!</p>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary flex-col gap-4 p-8 text-center">
            <div className="w-24 h-24 rounded-full bg-surface/50 flex items-center justify-center border border-white/5 shadow-xl">
               <MessageSquare size={48} className="text-primary/50" />
            </div>
            <h3 className="text-2xl font-semibold">Welcome, {user?.displayName || 'User'}!</h3>
            <p className="max-w-md text-lg">Search for a friend to view their profile, or scan their QR code to instantly connect!</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      
      {/* View Own Profile */}
      {showMyProfile && <ProfileModal onClose={() => setShowMyProfile(false)} />}
      
      {/* View Someone Else's Profile */}
      {viewingProfileUid && (
        <ProfileModal 
          targetUid={viewingProfileUid} 
          onClose={() => setViewingProfileUid(null)} 
          onStartChat={(u) => {
            setViewingProfileUid(null);
            setActiveChatUser(u);
          }}
        />
      )}

      {showScanner && (
        <QRScannerModal 
          onClose={() => setShowScanner(false)} 
          onScan={(uid) => {
            setViewingProfileUid(uid);
          }} 
        />
      )}
    </div>
  );
}
