import os

files = {
    'src/components/profile/ProfileModal.tsx': """import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { X, Camera, Lock, Globe, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

export default function ProfileModal({ 
  onClose, 
  targetUid, 
  onStartChat 
}: { 
  onClose: () => void; 
  targetUid?: string;
  onStartChat?: (user: any) => void;
}) {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSelf = !targetUid || targetUid === user?.uid;
  const fetchUid = targetUid || user?.uid;

  useEffect(() => {
    if (!fetchUid) return;
    const fetchProfile = async () => {
      const d = await getDoc(doc(db, 'users', fetchUid));
      if (d.exists()) {
        setProfile(d.data());
      }
      setLoading(false);
    };
    fetchProfile();
  }, [fetchUid]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSelf) return;
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploading(true);
    const toastId = toast.loading('Uploading photo...');
    try {
      const storageRef = ref(storage, `profiles/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      setProfile({ ...profile, photoURL: url });
      toast.success('Profile photo updated!', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to upload: ' + err.message, { id: toastId });
    }
    setUploading(false);
  };

  const togglePrivacy = async () => {
    if (!isSelf || !user || !profile) return;
    const newPrivacy = !profile.isPrivate;
    setProfile({ ...profile, isPrivate: newPrivacy });
    try {
      await updateDoc(doc(db, 'users', user.uid), { isPrivate: newPrivacy });
      toast.success(`Profile is now ${newPrivacy ? 'Private' : 'Public'}`);
    } catch (err) {
      setProfile({ ...profile, isPrivate: !newPrivacy }); // revert
      toast.error('Failed to update privacy.');
    }
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
       <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col relative text-text shadow-2xl border-white/20">
        <div className="absolute top-4 right-4 z-10">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors bg-black/20 text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center">
          {/* Avatar */}
          <div className={`relative group mb-4 ${isSelf ? 'cursor-pointer' : ''}`} onClick={() => isSelf && fileInputRef.current?.click()}>
            <div className="w-32 h-32 rounded-full border-4 border-primary/50 shadow-lg overflow-hidden bg-surface flex items-center justify-center">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl text-primary font-bold">{profile?.name?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            {isSelf && (
              <>
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={28} className="text-white" />
                </div>
                <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" disabled={uploading} />
              </>
            )}
          </div>

          <h2 className="text-3xl font-bold mt-2">{profile?.name}</h2>
          <p className="text-text-secondary text-lg mt-1">@{profile?.username}</p>
          
          <div className="flex gap-10 mt-8 w-full justify-center border-y border-white/10 py-4 bg-white/5 rounded-xl">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{profile?.followersCount || 0}</p>
              <p className="text-sm text-text-secondary font-medium uppercase tracking-wider">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{profile?.followingCount || 0}</p>
              <p className="text-sm text-text-secondary font-medium uppercase tracking-wider">Following</p>
            </div>
          </div>

          {!isSelf && onStartChat && (
            <button 
              onClick={() => onStartChat(profile)}
              className="mt-8 w-full py-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl flex justify-center items-center gap-2 hover:opacity-90 transition-opacity shadow-lg"
            >
              <MessageSquare size={20} />
              Message
            </button>
          )}

          {isSelf && (
            <div className="w-full mt-8 p-4 bg-surface/50 rounded-xl border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {profile?.isPrivate ? <Lock size={20} className="text-primary" /> : <Globe size={20} className="text-primary" />}
                <div>
                  <p className="font-semibold">Private Account</p>
                  <p className="text-xs text-text-secondary">Only followers can see your posts.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={profile?.isPrivate || false} onChange={togglePrivacy} className="sr-only peer" />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
""",
    'src/components/chat/Sidebar.tsx': """import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Search, UserPlus, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export default function Sidebar({ onSelectUser }: { onSelectUser: (user: any) => void }) {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    const searchUsers = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'users'),
          where('username', '>=', searchQuery.toLowerCase()),
          where('username', '<=', searchQuery.toLowerCase() + '\\uf8ff')
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs
          .map(doc => doc.data())
          .filter(u => u.uid !== user?.uid); // Don't show self
        setSearchResults(results);
      } catch (err) {
        console.error("Error searching:", err);
      }
      setLoading(false);
    };
    
    const timeout = setTimeout(searchUsers, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, user]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 bg-white/5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Search username..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/20 rounded-xl focus:outline-none focus:border-primary text-text placeholder-white/60 transition-colors shadow-inner"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {loading && <div className="text-center p-4 text-text-secondary">Searching...</div>}
        {!loading && searchQuery && searchResults.length === 0 && (
          <div className="text-center p-4 text-text-secondary">No users found.</div>
        )}
        
        {searchResults.map((u) => (
          <button 
            key={u.uid}
            onClick={() => onSelectUser(u)}
            className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-xl transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border border-white/10">
              {u.photoURL ? (
                <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={24} className="text-primary" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-text">{u.name}</h4>
              <p className="text-sm text-text-secondary">@{u.username}</p>
            </div>
          </button>
        ))}
        
        {!searchQuery && (
          <div className="h-full flex flex-col items-center justify-center text-text-secondary opacity-50 p-4 text-center space-y-2">
            <UserPlus size={32} />
            <p>Search for a username to view profile and chat!</p>
          </div>
        )}
      </div>
    </div>
  );
}
""",
    'src/components/chat/ChatLayout.tsx': """import { useState, useEffect } from 'react';
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
      <div className={`\\${activeChatUser ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-white/10 flex-col bg-surface/50 backdrop-blur-md transition-all`}>
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
      <div className={`\\${!activeChatUser ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-background/50 relative transition-all`}>
        
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
"""
}

for p, c in files.items():
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)

print("Updated Profile routing, Search Placeholder, and Scanner Logic!")
