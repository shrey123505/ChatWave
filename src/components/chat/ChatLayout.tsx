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
import { LogOut, Settings as SettingsIcon, MessageSquare, UserCircle, ScanLine } from 'lucide-react';
import SettingsModal from '../settings/SettingsModal';
import ProfileModal from '../profile/ProfileModal';
import QRScannerModal from '../settings/QRScannerModal';
import CallModal from '../call/CallModal';
import IncomingCallModal from '../call/IncomingCallModal';
import Sidebar from './Sidebar';
import ChatRoom from './ChatRoom';
import MobileBottomNav, { type MobileTab } from './MobileBottomNav';
import { useAuthStore } from '../../store/useAuthStore';
import { Toaster, toast } from 'react-hot-toast';

export default function ChatLayout() {
  const { user } = useAuthStore();
  
  // Navigation & Modal States
  const [mobileTab, setMobileTab] = useState<MobileTab>('chats');
  const [showSettings, setShowSettings] = useState(false);
  const [showMyProfileModal, setShowMyProfileModal] = useState(false);
  const [viewingProfileUser, setViewingProfileUser] = useState<any | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [activeChatUser, setActiveChatUser] = useState<any | null>(null);

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
        if (change.type === 'added') {
          const callData = { id: change.doc.id, ...change.doc.data() };
          setIncomingCall(callData);
        } else if (change.type === 'modified' || change.type === 'removed') {
          const status = change.doc.data().status;
          if (status === 'ended' || status === 'declined') {
            setIncomingCall((prev: any) => (prev?.id === change.doc.id ? null : prev));
          }
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

        {/* Desktop Contacts & Search */}
        <div className="flex-1 overflow-hidden">
          <Sidebar 
            mode="all"
            onSelectUser={(selected) => setViewingProfileUser(selected)} 
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
          <div className="flex-1 flex items-center justify-center text-text-secondary flex-col gap-4 p-8 text-center">
            <div className="w-24 h-24 rounded-full bg-surface/50 flex items-center justify-center border border-white/10 shadow-2xl">
              <MessageSquare size={48} className="text-primary/70" />
            </div>
            <h3 className="text-2xl font-semibold text-text">
              Welcome, {user?.displayName || 'User'}!
            </h3>
            <p className="max-w-md text-sm text-text-secondary">
              Select a contact on the left to start chatting, voice calling, or video calling.
            </p>
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

                <div className="flex-1 overflow-hidden">
                  <Sidebar 
                    mode="all"
                    onSelectUser={(selected) => setViewingProfileUser(selected)} 
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
                    onSelectUser={(selected) => setViewingProfileUser(selected)} 
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
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      
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
    </div>
  );
}
