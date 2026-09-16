import { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  LogOut, 
  Settings as SettingsIcon, 
  MessageSquare, 
  UserCircle, 
  ScanLine,
  ShieldCheck,
  Lock, 
  Sparkles, 
  Phone,
  Bell,
  Crown
} from 'lucide-react';
import SettingsModal from '../settings/SettingsModal';
import ProfileModal from '../profile/ProfileModal';
import QRScannerModal from '../settings/QRScannerModal';
import CallModal from '../call/CallModal';
import IncomingCallModal from '../call/IncomingCallModal';
import NotificationModal from '../notifications/NotificationModal';
import AdminDashboardModal from '../admin/AdminDashboardModal';
import Sidebar from './Sidebar';
import ChatRoom from './ChatRoom';
import MobileBottomNav, { type MobileTab } from './MobileBottomNav';
import StoriesBar, { type StoryGroup } from '../stories/StoriesBar';
import CreateStoryModal from '../stories/CreateStoryModal';
import StoryViewerModal from '../stories/StoryViewerModal';
import { usePresence } from '../../hooks/usePresence';
import { useGlobalNotifications } from '../../hooks/useGlobalNotifications';
import { showSystemNotification } from '../../utils/notification';
import { useAuthStore } from '../../store/useAuthStore';
import { isAdmin } from '../../utils/admin';
import { Toaster, toast } from 'react-hot-toast';

export default function ChatLayout() {
  const { user, userProfile } = useAuthStore();
  const isUserAdmin = isAdmin(userProfile, user);
  usePresence();
  
  // Navigation & Modal States
  const [mobileTab, setMobileTab] = useState<MobileTab>('chats');
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showMyProfileModal, setShowMyProfileModal] = useState(false);
  const [viewingProfileUser, setViewingProfileUser] = useState<any | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [activeChatUser, setActiveChatUser] = useState<any | null>(null);

  // Stories States
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null);

  // Notifications States
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'users', user.uid, 'inbox'));
    const unsub = onSnapshot(q, (snap) => {
      setUnreadNotifCount(snap.docs.length);
    });
    return () => unsub();
  }, [user?.uid]);

  // Global Notification Hub: plays soft chime and shows system alert when message arrives
  useGlobalNotifications({
    activeChatUid: activeChatUser?.uid || null,
    onSelectChat: (chatUser) => {
      setViewingProfileUser(null);
      setActiveChatUser(chatUser);
    }
  });

  // Audio / Video Call States
  const [activeCall, setActiveCall] = useState<{
    callId: string;
    isCaller: boolean;
    callType: 'video' | 'audio';
    remoteUser: any;
  } | null>(null);

  const [incomingCall, setIncomingCall] = useState<any | null>(null);

  // 1. Real-time Listener for Incoming Calls to Current User
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'calling')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const callData: any = { id: change.doc.id, ...change.doc.data() };
        if (change.type === 'added') {
          setIncomingCall(callData);
          showSystemNotification(
            `📞 Incoming ${callData.type === 'video' ? 'Video' : 'Audio'} Call`,
            `${callData.callerName || 'Someone'} is calling you... Click to answer`,
            callData.callerPhotoURL || '/favicon.svg'
          );
          toast(
            `📞 Incoming ${callData.type === 'video' ? 'Video' : 'Audio'} Call from ${callData.callerName || 'Someone'}`,
            { icon: '🔔', duration: 7000 }
          );
        } else if (change.type === 'modified') {
          if (callData.status !== 'calling') {
            setIncomingCall((prev: any) => (prev?.id === change.doc.id ? null : prev));
          } else {
            setIncomingCall((prev: any) => (prev?.id === change.doc.id ? callData : prev));
          }
        } else if (change.type === 'removed') {
          setIncomingCall((prev: any) => (prev?.id === change.doc.id ? null : prev));
        }
      });
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // 2. Start an Outgoing Call
  const handleStartCall = async (type: 'video' | 'audio') => {
    if (!user || !activeChatUser) return;

    try {
      const callDocRef = await addDoc(collection(db, 'calls'), {
        callerId: user.uid,
        callerName: user.displayName || user.email || 'Friend',
        callerPhotoURL: user.photoURL || '',
        receiverId: activeChatUser.uid,
        receiverName: activeChatUser.name || 'User',
        receiverPhotoURL: activeChatUser.photoURL || '',
        status: 'calling',
        type,
        createdAt: serverTimestamp()
      });

      setActiveCall({
        callId: callDocRef.id,
        isCaller: true,
        callType: type,
        remoteUser: activeChatUser
      });
    } catch (err: any) {
      console.error("Failed to start call:", err);
      toast.error("Call failed to initialize: " + err.message);
    }
  };

  // 3. Accept Incoming Call
  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;
    setActiveCall({
      callId: incomingCall.id,
      isCaller: false,
      callType: incomingCall.type,
      remoteUser: {
        uid: incomingCall.callerId,
        name: incomingCall.callerName,
        photoURL: incomingCall.callerPhotoURL
      }
    });
    setIncomingCall(null);
  };

  // 4. Decline Incoming Call
  const handleDeclineIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      await updateDoc(doc(db, 'calls', incomingCall.id), {
        status: 'declined',
        endedAt: serverTimestamp()
      });
    } catch {}
    setIncomingCall(null);
  };

  // 5. Handle URL scanning: ?user=UID
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const scannedUid = urlParams.get('user');
    if (scannedUid) {
      if (user && scannedUid === user.uid) {
        toast("This is your own QR code!");
      } else {
        getDoc(doc(db, 'users', scannedUid))
          .then((d) => {
            if (d.exists()) {
              setViewingProfileUser({ uid: d.id, ...d.data() });
            } else {
              toast.error("User not found in database");
            }
          })
          .catch((err) => {
            console.error("Error finding scanned user:", err);
            toast.error("Could not load scanned user");
          });
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [user]);

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-background text-text relative select-none">
      <Toaster position="top-center" />

      {/* =========================================
          DESKTOP VIEW (Side-by-side Layout: md:)
          ========================================= */}
      
      {/* Desktop Left Sidebar */}
      <div className="hidden md:flex w-80 lg:w-96 border-r border-white/10 flex-col bg-surface/50 backdrop-blur-md transition-all h-full overflow-hidden">
        {/* Desktop Header */}
        <div className="flex-shrink-0 p-3.5 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <MessageSquare size={24} /> ChatWave
          </h2>
          <div className="flex items-center gap-1.5">
            {isUserAdmin && (
              <button 
                onClick={() => setShowAdminDashboard(true)} 
                className="py-1 px-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/30 text-xs font-bold shadow-md shadow-amber-500/10 transition-all flex items-center gap-1.5 active:scale-95"
                title="Admin Command Center"
              >
                <Crown size={15} className="text-amber-400 fill-amber-400/20" />
                <span className="hidden lg:inline">Admin</span>
              </button>
            )}
            <button 
              onClick={() => setShowScanner(true)} 
              className="p-2 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors" 
              title="Scan QR Code"
            >
              <ScanLine size={20} />
            </button>
            <button 
              onClick={() => setShowMyProfileModal(true)} 
              className="p-2 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors" 
              title="My Profile"
            >
              <UserCircle size={20} />
            </button>
            <button 
              onClick={() => setShowNotifications(true)} 
              className="relative p-2 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors" 
              title="Notifications"
            >
              <Bell size={20} />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-sm">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => setShowSettings(true)} 
              className="p-2 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors" 
              title="Settings & Themes"
            >
              <SettingsIcon size={20} />
            </button>
            <button 
              onClick={() => auth.signOut()} 
              className="p-2 rounded-full hover:bg-red-500/20 text-red-400 transition-colors" 
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Desktop Stories Bar */}
        <StoriesBar 
          onOpenCreate={() => setShowCreateStory(true)}
          onViewStory={(group) => setActiveStoryGroup(group)}
        />

        {/* Desktop Contacts & Search */}
        <div className="flex-1 overflow-hidden">
          <Sidebar 
            mode="chats"
            onSelectChat={(selected) => {
              setViewingProfileUser(null);
              setActiveChatUser(selected);
            }}
            onSelectUser={(selected) => setViewingProfileUser(selected)} 
            onOpenScanner={() => setShowScanner(true)}
          />
        </div>
      </div>

      {/* Desktop Main Content Area */}
      <div className="hidden md:flex flex-1 flex-col bg-background/50 relative h-full overflow-hidden">
        {activeChatUser ? (
          <ChatRoom 
            activeUser={activeChatUser} 
            onBack={() => setActiveChatUser(null)}
            onViewProfile={() => setViewingProfileUser(activeChatUser)}
            onStartCall={handleStartCall}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none relative overflow-hidden">
            {/* Ambient Background Aura */}
            <div className="absolute w-96 h-96 rounded-full bg-primary/10 filter blur-3xl pointer-events-none -top-12" />
            <div className="absolute w-96 h-96 rounded-full bg-indigo-500/10 filter blur-3xl pointer-events-none -bottom-12" />

            <div className="relative z-10 flex flex-col items-center max-w-md">
              {/* Branded Emblem */}
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-primary/25 via-primary/15 to-transparent border border-white/10 flex items-center justify-center shadow-2xl mb-6 relative">
                <div className="absolute inset-0 rounded-3xl bg-primary/10 animate-pulse pointer-events-none" />
                <MessageSquare size={38} className="text-primary relative z-10" />
              </div>

              <h2 className="text-2xl font-bold text-text tracking-tight mb-2">
                ChatWave for Web
              </h2>

              <p className="text-sm text-text-secondary leading-relaxed mb-6">
                Send and receive messages with zero lag. High-definition peer-to-peer audio and video calling right inside your browser.
              </p>

              {/* Feature Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/[0.08] text-text-secondary">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  End-to-End Encrypted
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/[0.08] text-text-secondary">
                  <Sparkles size={14} className="text-amber-400" />
                  Real-Time Presence
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/[0.08] text-text-secondary">
                  <Phone size={14} className="text-blue-400" />
                  P2P Audio & Video
                </span>
              </div>

              {/* Privacy Footer Hint */}
              <div className="text-xs text-text-secondary/70 flex items-center gap-1.5">
                <Lock size={12} />
                <span>Your personal messages and calls are completely private.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================
          MOBILE VIEW (Instagram-style Tabbed Layout)
          ========================================= */}
      <div className="md:hidden flex flex-1 flex-col h-full h-[100dvh] w-full overflow-hidden relative">
        {activeChatUser ? (
          /* Full-screen Chat on Mobile (Header & Footer are locked, middle scrolls) */
          <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
            <ChatRoom 
              activeUser={activeChatUser} 
              onBack={() => setActiveChatUser(null)}
              onViewProfile={() => setViewingProfileUser(activeChatUser)}
              onStartCall={handleStartCall}
            />
          </div>
        ) : (
          /* Main Tabbed Mobile Screens */
          <div className="flex-1 flex flex-col h-full overflow-hidden pb-16">
            
            {/* Tab 1: Chats Screen */}
            {mobileTab === 'chats' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-shrink-0 p-3.5 border-b border-white/10 flex justify-between items-center bg-surface/80 backdrop-blur-md">
                  <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                    <MessageSquare size={22} /> ChatWave
                  </h2>
                  <div className="flex items-center gap-1">
                    {isUserAdmin && (
                      <button 
                        onClick={() => setShowAdminDashboard(true)} 
                        className="p-2 rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-400/40 transition-colors" 
                        title="Admin Command Center"
                      >
                        <Crown size={18} className="fill-amber-400/20" />
                      </button>
                    )}
                    <button 
                      onClick={() => setShowNotifications(true)} 
                      className="relative p-2 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors" 
                      title="Notifications"
                    >
                      <Bell size={20} />
                      {unreadNotifCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-sm">
                          {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                        </span>
                      )}
                    </button>
                    <button 
                      onClick={() => setShowSettings(true)} 
                      className="p-2 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors" 
                      title="Settings"
                    >
                      <SettingsIcon size={20} />
                    </button>
                    <button 
                      onClick={() => auth.signOut()} 
                      className="p-2 rounded-full hover:bg-red-500/20 text-red-400 transition-colors" 
                      title="Logout"
                    >
                      <LogOut size={20} />
                    </button>
                  </div>
                </div>

                {/* Mobile Stories Bar */}
                <StoriesBar 
                  onOpenCreate={() => setShowCreateStory(true)}
                  onViewStory={(group) => setActiveStoryGroup(group)}
                />

                <div className="flex-1 overflow-hidden">
                  <Sidebar 
                    mode="chats"
                    onSelectChat={(selected) => {
                      setViewingProfileUser(null);
                      setActiveChatUser(selected);
                    }}
                    onSelectUser={(selected) => setViewingProfileUser(selected)} 
                    onOpenScanner={() => setShowScanner(true)}
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Dedicated Search Screen */}
            {mobileTab === 'search' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <Sidebar 
                    mode="search"
                    onSelectChat={(selected) => {
                      setViewingProfileUser(null);
                      setActiveChatUser(selected);
                    }}
                    onSelectUser={(selected) => setViewingProfileUser(selected)} 
                    onOpenScanner={() => setShowScanner(true)}
                  />
                </div>
              </div>
            )}

            {/* Tab 3: My Profile Tab */}
            {mobileTab === 'profile' && (
              <div className="flex-1 flex flex-col h-full overflow-y-auto">
                <ProfileModal 
                  embedded={true}
                  onOpenSettings={() => setShowSettings(true)}
                />
              </div>
            )}

            {/* Sticky Bottom Navigation Bar on Mobile */}
            <MobileBottomNav 
              activeTab={mobileTab}
              onTabChange={(tab) => setMobileTab(tab)}
              onOpenScanner={() => setShowScanner(true)}
            />
          </div>
        )}
      </div>

      {/* =========================================
          MODALS & OVERLAYS
          ========================================= */}

      {/* WebRTC Active Call Modal */}
      {activeCall && (
        <CallModal 
          callId={activeCall.callId}
          isCaller={activeCall.isCaller}
          callType={activeCall.callType}
          remoteUser={activeCall.remoteUser}
          onEndCall={() => setActiveCall(null)}
        />
      )}

      {/* Incoming Call Dialog Alert */}
      {incomingCall && !activeCall && (
        <IncomingCallModal 
          call={incomingCall}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          onOpenAdmin={() => setShowAdminDashboard(true)}
        />
      )}

      {/* Admin Command Center Modal */}
      {showAdminDashboard && (
        <AdminDashboardModal onClose={() => setShowAdminDashboard(false)} />
      )}
      
      {/* Desktop Own Profile Modal */}
      {showMyProfileModal && (
        <ProfileModal 
          onClose={() => setShowMyProfileModal(false)} 
          onOpenSettings={() => {
            setShowMyProfileModal(false);
            setShowSettings(true);
          }}
        />
      )}
      
      {/* View Selected User Profile Modal */}
      {viewingProfileUser && (
        <ProfileModal 
          initialProfile={viewingProfileUser}
          targetUid={viewingProfileUser.uid} 
          onClose={() => setViewingProfileUser(null)} 
          onStartChat={(chatUser) => {
            setViewingProfileUser(null);
            setActiveChatUser(chatUser);
          }}
        />
      )}

      {/* QR Code Camera Scanner Modal */}
      {showScanner && (
        <QRScannerModal 
          onClose={() => setShowScanner(false)} 
          onScan={(scannedUid) => {
            if (user && scannedUid === user.uid) {
              toast("This is your own QR code!");
              return;
            }
            getDoc(doc(db, 'users', scannedUid)).then((d) => {
              if (d.exists()) {
                setViewingProfileUser({ uid: d.id, ...d.data() });
              } else {
                toast.error("User not found in database");
              }
            }).catch(err => {
              toast.error("Error loading user: " + err.message);
            });
          }} 
        />
      )}

      {/* Create 24h Story Modal */}
      {showCreateStory && (
        <CreateStoryModal onClose={() => setShowCreateStory(false)} />
      )}

      {/* View 24h Story Modal */}
      {activeStoryGroup && (
        <StoryViewerModal 
          group={activeStoryGroup} 
          onClose={() => setActiveStoryGroup(null)} 
        />
      )}

      {/* Activity & Notifications Modal */}
      {showNotifications && (
        <NotificationModal
          onClose={() => setShowNotifications(false)}
          onStartCall={(targetUser, type) => {
            setActiveChatUser(targetUser);
            handleStartCall(type);
          }}
          onSelectChat={(chatUser) => {
            setViewingProfileUser(null);
            setActiveChatUser(chatUser);
            setShowNotifications(false);
          }}
        />
      )}
    </div>
  );
}
