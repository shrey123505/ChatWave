import { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
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
  const [showProfile, setShowProfile] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [activeChatUser, setActiveChatUser] = useState<any>(null);

  // Handle URL scanning
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const scannedUid = urlParams.get('user');
    if (scannedUid && user && scannedUid !== user.uid) {
      // Fetch user and set as active chat
      getDoc(doc(db, 'users', scannedUid)).then(d => {
        if (d.exists()) setActiveChatUser(d.data());
      });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [user]);

  return (
    <div className="flex h-screen bg-background overflow-hidden text-text">
      <Toaster position="top-center" />
      
      {/* Left Panel (Hidden on mobile if chat is active) */}
      <div className={\`\${activeChatUser ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-white/10 flex-col bg-surface/50 backdrop-blur-md transition-all\`}>
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <MessageSquare size={24} /> ChatWave
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setShowScanner(true)} className="p-2 rounded-full hover:bg-white/10 text-text-secondary transition-colors" title="Scan QR">
              <ScanLine size={20} />
            </button>
            <button onClick={() => setShowProfile(true)} className="p-2 rounded-full hover:bg-white/10 text-text-secondary transition-colors" title="Profile">
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
        
        {/* Search & Users List */}
        <Sidebar onSelectUser={(u) => setActiveChatUser(u)} />
      </div>

      {/* Main Chat Area (Hidden on mobile if NO chat is active) */}
      <div className={\`\${!activeChatUser ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-background/50 relative transition-all\`}>
        
        {/* Mobile Back Button (Only shows when chat is active on small screens) */}
        {activeChatUser && (
          <div className="md:hidden p-4 border-b border-white/10 flex items-center gap-2 bg-surface/50">
            <button onClick={() => setActiveChatUser(null)} className="text-primary font-medium hover:underline">
              ← Back
            </button>
            <span className="font-bold ml-2">{activeChatUser.name}</span>
          </div>
        )}

        {activeChatUser ? (
          <div className="flex-1 flex items-center justify-center flex-col text-text-secondary">
             <div className="w-20 h-20 rounded-full overflow-hidden bg-primary/20 mb-4">
                {activeChatUser.photoURL ? (
                  <img src={activeChatUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle size={80} className="text-primary" />
                )}
             </div>
             <h3 className="text-2xl font-bold text-text">{activeChatUser.name}</h3>
             <p>@{activeChatUser.username}</p>
             <p className="mt-4 text-sm bg-white/5 px-4 py-2 rounded-lg">Chatting functionality coming next!</p>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary flex-col gap-4 p-8 text-center">
            <div className="w-24 h-24 rounded-full bg-surface/50 flex items-center justify-center border border-white/5 shadow-xl">
               <MessageSquare size={48} className="text-primary/50" />
            </div>
            <h3 className="text-2xl font-semibold">Welcome, {user?.displayName || 'User'}!</h3>
            <p className="max-w-md">Search for a username on the left, or click the <ScanLine className="inline mx-1" size={18}/> scanner to scan a friend's QR code.</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showScanner && (
        <QRScannerModal 
          onClose={() => setShowScanner(false)} 
          onScan={(uid) => {
            getDoc(doc(db, 'users', uid)).then(d => {
              if (d.exists()) setActiveChatUser(d.data());
            });
          }} 
        />
      )}
    </div>
  );
}
