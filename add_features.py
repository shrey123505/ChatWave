import os

files = {
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
      <div className="p-4 border-b border-white/10">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Search username..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface/50 border border-white/10 rounded-xl focus:outline-none focus:border-primary text-text placeholder-text-secondary transition-colors"
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
            className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
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
            <p>Search for a username to start chatting!</p>
          </div>
        )}
      </div>
    </div>
  );
}
""",
    'src/components/profile/ProfileModal.tsx': """import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { X, Camera, Lock, Globe } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const d = await getDoc(doc(db, 'users', user.uid));
      if (d.exists()) {
        setProfile(d.data());
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!user || !profile) return;
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

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col relative text-text">
        <div className="absolute top-4 right-4 z-10">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors bg-black/20">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          {/* Avatar */}
          <div className="relative group cursor-pointer mb-4" onClick={() => fileInputRef.current?.click()}>
            <div className="w-28 h-28 rounded-full border-4 border-surface overflow-hidden bg-surface flex items-center justify-center">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl text-primary font-bold">{profile?.name?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={24} className="text-white" />
            </div>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" disabled={uploading} />
          </div>

          <h2 className="text-2xl font-bold">{profile?.name}</h2>
          <p className="text-text-secondary">@{profile?.username}</p>
          
          <div className="flex gap-8 mt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{profile?.followersCount || 0}</p>
              <p className="text-sm text-text-secondary">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{profile?.followingCount || 0}</p>
              <p className="text-sm text-text-secondary">Following</p>
            </div>
          </div>

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
        </div>
      </div>
    </div>
  );
}
""",
    'src/components/settings/QRScannerModal.tsx': """import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function QRScannerModal({ onClose, onScan }: { onClose: () => void, onScan: (uid: string) => void }) {
  const [error, setError] = useState('');
  
  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        // Expected format: https://domain.com?user=UID
        try {
          const url = new URL(decodedText);
          const uid = url.searchParams.get('user');
          if (uid) {
            html5QrCode.stop();
            onScan(uid);
            onClose();
          } else {
            toast.error("Invalid ChatWave QR code");
          }
        } catch(e) {
          toast.error("Invalid QR code format");
        }
      },
      (err) => {
        // Scanning errors are frequent, ignore them until success
      }
    ).catch(err => {
      setError("Camera permission denied or camera not found.");
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onClose, onScan]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden flex flex-col relative text-text">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-surface/50">
          <h2 className="text-xl font-bold">Scan QR Code</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 flex flex-col items-center">
           {error ? (
             <div className="text-red-400 text-center p-4">{error}</div>
           ) : (
             <div id="reader" className="w-full max-w-sm rounded-xl overflow-hidden border-2 border-primary"></div>
           )}
           <p className="mt-4 text-text-secondary text-sm text-center">
             Point your camera at a friend's ChatWave QR code to instantly start chatting.
           </p>
        </div>
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
      
      {/* Left Panel */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-surface/50 backdrop-blur-md">
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

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background/50">
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
"""
}

for p, c in files.items():
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        f.write(c)

print("Added Search, Profile, and QR Scanner features!")
