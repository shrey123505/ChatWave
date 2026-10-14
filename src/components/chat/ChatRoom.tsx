import { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  updateDoc, 
  setDoc,
  getDoc,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  Send, 
  ArrowLeft, 
  User as UserIcon, 
  Trash2, 
  Smile, 
  Reply, 
  X,
  Paperclip,
  Mic,
  CheckCheck,
  Maximize2,
  Phone,
  Video,
  MoreVertical,
  BellOff,
  Bell,
  Ban,
  AlertTriangle,
  UserCheck,
  Lock,
  UserPlus,
  Search,
  Edit2,
  Copy,
  Check
} from 'lucide-react';
import { compressImage } from '../../utils/imageCompressor';
import { playNotificationSound, showSystemNotification, requestNotificationPermission } from '../../utils/notification';
import { formatPresence } from '../../hooks/usePresence';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import ReportUserModal from './ReportUserModal';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  type?: 'text' | 'image' | 'audio';
  createdAt: any;
  seen?: boolean;
  isEdited?: boolean;
  replyTo?: {
    id: string;
    text?: string;
    imageUrl?: string;
    audioUrl?: string;
    senderName: string;
  };
  reaction?: string;
}

const QUICK_REACTIONS = ['❤️', '👍', '😂', '🔥', '👏', '😮'];
const EMOJI_PALETTE = ['😀', '😂', '🥰', '😎', '🤩', '🥳', '😭', '🙏', '🔥', '❤️', '✨', '👍', '👏', '🎉', '💯', '🚀', '💬', '⚡', '🌟', '🤝'];

export default function ChatRoom({ 
  activeUser, 
  onBack, 
  onViewProfile,
  onStartCall
}: { 
  activeUser: any; 
  onBack: () => void; 
  onViewProfile: () => void;
  onStartCall: (type: 'video' | 'audio') => void;
}) {
  const { user, userProfile } = useAuthStore();
  const myPhoto = userProfile?.photoURL || user?.photoURL || '';
  const myName = userProfile?.name || user?.displayName || 'User';
  const myUsername = userProfile?.username || (user as any)?.username || '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showReactionPickerFor, setShowReactionPickerFor] = useState<string | null>(null);
  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // In-Chat Message Search State
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  
  // Real-time Presence & Active User Live Data
  const [liveUserData, setLiveUserData] = useState<any>(activeUser);

  // Typing Indicator States
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safety, Follow & Mute States
  const [isMuted, setIsMuted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitialLoad = useRef(true);

  // Deterministic chatId between current user and activeUser
  const chatId = user?.uid && activeUser?.uid
    ? [user.uid, activeUser.uid].sort().join('_')
    : null;

  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  // Check Mute Status & Blocked Status from localStorage/Firestore
  useEffect(() => {
    if (!chatId || !user?.uid || !activeUser?.uid) return;

    const muted = localStorage.getItem(`chatwave_muted_${chatId}`) === 'true';
    setIsMuted(muted);

    getDoc(doc(db, 'users', user.uid, 'blockedUsers', activeUser.uid)).then((d) => {
      setIsBlocked(d.exists());
    });

    getDoc(doc(db, 'users', activeUser.uid, 'followers', user.uid)).then((d) => {
      setIsFollowing(d.exists());
    });
  }, [chatId, user?.uid, activeUser?.uid]);

  // Handle Following directly from Chat
  const handleFollowFromChat = async () => {
    if (!user?.uid || !activeUser?.uid || followingLoading) return;
    setFollowingLoading(true);
    try {
      const followerRef = doc(db, 'users', activeUser.uid, 'followers', user.uid);
      const followingRef = doc(db, 'users', user.uid, 'following', activeUser.uid);
      await setDoc(followerRef, { followedAt: new Date().toISOString() });
      await setDoc(followingRef, { followedAt: new Date().toISOString() });
      await updateDoc(doc(db, 'users', activeUser.uid), { followersCount: increment(1) }).catch(() => {});
      await updateDoc(doc(db, 'users', user.uid), { followingCount: increment(1) }).catch(() => {});

      await addDoc(collection(db, 'users', activeUser.uid, 'inbox'), {
        type: 'follow',
        senderId: user.uid,
        senderName: myName,
        senderPhotoURL: myPhoto,
        text: 'Started following you',
        timestamp: Date.now()
      }).catch(() => {});

      setIsFollowing(true);
      toast.success(`You are now following @${liveUserData?.username || activeUser?.username || 'user'}! Chat unlocked.`);
    } catch (err: any) {
      toast.error('Failed to follow: ' + err.message);
    } finally {
      setFollowingLoading(false);
    }
  };

  const isPrivateLocked = liveUserData?.isPrivate && !isFollowing && user?.uid !== activeUser?.uid;

  // Real-time Listener for Active User's Presence (isOnline / lastSeen)
  useEffect(() => {
    if (!activeUser?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', activeUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setLiveUserData({ uid: docSnap.id, ...docSnap.data() });
      }
    });
    return () => unsub();
  }, [activeUser?.uid]);

  // Real-time Firestore Listener for Messages
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Message[];

      if (!isInitialLoad.current && snapshot.docChanges().some(change => change.type === 'added' && change.doc.data().senderId === activeUser.uid)) {
        const isChatMuted = localStorage.getItem(`chatwave_muted_${chatId}`) === 'true';
        if (!isChatMuted) {
          playNotificationSound();
        }

        const latestMsg = msgs[msgs.length - 1];
        if (latestMsg && document.hidden) {
          showSystemNotification(
            `${activeUser.name || 'Friend'} on ChatWave`,
            latestMsg.text || (latestMsg.imageUrl ? '📷 Sent a photo' : '🎙️ Sent a voice note')
          );
        }
      }
      isInitialLoad.current = false;

      setMessages(msgs);

      // Mark unread messages from other user as seen
      if (user?.uid) {
        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (data.senderId === activeUser.uid && !data.seen) {
            updateDoc(doc(db, 'chats', chatId, 'messages', d.id), { seen: true }).catch(() => {});
          }
        });
      }
    }, (err) => {
      console.error("Firestore message listener error:", err);
      toast.error("Real-time sync error: " + err.message);
    });

    return () => unsubscribe();
  }, [chatId, activeUser.uid, activeUser.name, user?.uid]);

  // Real-time Listener for Other User's Typing Indicator
  useEffect(() => {
    if (!chatId || !activeUser?.uid) return;

    const typingDocRef = doc(db, 'chats', chatId, 'typing', activeUser.uid);
    const unsubscribe = onSnapshot(typingDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const now = Date.now();
        if (data.isTyping && now - (data.timestamp || 0) < 4000) {
          setIsOtherTyping(true);
        } else {
          setIsOtherTyping(false);
        }
      } else {
        setIsOtherTyping(false);
      }
    });

    return () => unsubscribe();
  }, [chatId, activeUser?.uid]);

  // Auto-scroll to bottom on new message or typing
  useEffect(() => {
    if (!chatSearchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOtherTyping, chatSearchQuery]);

  // Handle Input Changes & Set Typing Status
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!chatId || !user) return;

    const typingDocRef = doc(db, 'chats', chatId, 'typing', user.uid);
    setDoc(typingDocRef, { isTyping: true, timestamp: Date.now() }, { merge: true }).catch(() => {});

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(typingDocRef, { isTyping: false, timestamp: Date.now() }, { merge: true }).catch(() => {});
    }, 2500);
  };

  const stopTypingImmediate = () => {
    if (!chatId || !user) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    const typingDocRef = doc(db, 'chats', chatId, 'typing', user.uid);
    setDoc(typingDocRef, { isTyping: false, timestamp: Date.now() }, { merge: true }).catch(() => {});
  };

  // Keep both users' conversation cards synced in real time
  const syncConversations = (previewText: string, messageType: 'text' | 'image' | 'audio') => {
    if (!user?.uid || !activeUser?.uid) return;
    const now = Date.now();

    const myConvRef = doc(db, 'users', user.uid, 'conversations', activeUser.uid);
    setDoc(myConvRef, {
      peerUid: activeUser.uid,
      peerName: liveUserData?.name || activeUser.name || 'User',
      peerUsername: liveUserData?.username || activeUser.username || '',
      peerPhotoURL: liveUserData?.photoURL || activeUser.photoURL || '',
      isPrivate: !!(liveUserData?.isPrivate ?? activeUser.isPrivate),
      isOnline: !!liveUserData?.isOnline,
      lastMessage: previewText,
      lastMessageType: messageType,
      lastMessageTime: now,
      unread: false,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});

    const peerConvRef = doc(db, 'users', activeUser.uid, 'conversations', user.uid);
    setDoc(peerConvRef, {
      peerUid: user.uid,
      peerName: myName,
      peerUsername: myUsername,
      peerPhotoURL: myPhoto,
      isPrivate: !!userProfile?.isPrivate,
      isOnline: true,
      lastMessage: previewText,
      lastMessageType: messageType,
      lastMessageTime: now,
      unread: true,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});
  };

  // Mark this conversation as read when active
  useEffect(() => {
    if (!user?.uid || !activeUser?.uid) return;
    updateDoc(doc(db, 'users', user.uid, 'conversations', activeUser.uid), {
      unread: false
    }).catch(() => {});
  }, [user?.uid, activeUser?.uid]);

  // Send or Edit Text Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isBlocked) {
      toast.error("Unblock user to send messages.");
      return;
    }

    const trimmed = inputText.trim();
    if (!trimmed || !chatId || !user) return;

    setInputText('');
    setShowEmojiDrawer(false);
    stopTypingImmediate();

    // Handle Message Edit Mode
    if (editingMessage) {
      const targetMsg = editingMessage;
      setEditingMessage(null);
      try {
        await updateDoc(doc(db, 'chats', chatId, 'messages', targetMsg.id), {
          text: trimmed,
          isEdited: true
        });
        toast.success("Message updated");
      } catch (err: any) {
        toast.error("Failed to edit message: " + err.message);
      }
      return;
    }

    const replySnapshot = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text || (replyingTo.imageUrl ? '📷 Photo' : '🎙️ Voice Message'),
      senderName: replyingTo.senderName
    } : null;
    setReplyingTo(null);

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        senderName: myName,
        text: trimmed,
        type: 'text',
        seen: false,
        replyTo: replySnapshot,
        createdAt: serverTimestamp()
      });

      syncConversations(trimmed, 'text');

      if (activeUser?.uid) {
        setDoc(doc(db, 'users', activeUser.uid, 'inbox', user.uid), {
          senderId: user.uid,
          senderName: myName,
          senderUsername: myUsername,
          senderPhotoURL: myPhoto,
          text: trimmed,
          timestamp: Date.now()
        }, { merge: true }).catch(() => {});
      }
    } catch (err: any) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send: " + err.message);
    }
  };

  // Send Image Message
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isBlocked) {
      toast.error("Unblock user to send photos.");
      return;
    }

    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;

    setIsUploadingImage(true);
    const toastId = toast.loading("Sending photo...");

    try {
      const compressedBase64 = await compressImage(file, 800, 800, 0.72);

      const replySnapshot = replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text || (replyingTo.imageUrl ? '📷 Photo' : '🎙️ Voice Message'),
        senderName: replyingTo.senderName
      } : null;
      setReplyingTo(null);

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        senderName: myName,
        imageUrl: compressedBase64,
        type: 'image',
        seen: false,
        replyTo: replySnapshot,
        createdAt: serverTimestamp()
      });

      syncConversations('📷 Photo', 'image');

      if (activeUser?.uid) {
        setDoc(doc(db, 'users', activeUser.uid, 'inbox', user.uid), {
          senderId: user.uid,
          senderName: myName,
          senderUsername: myUsername,
          senderPhotoURL: myPhoto,
          text: '📷 Photo',
          timestamp: Date.now()
        }, { merge: true }).catch(() => {});
      }

      toast.success("Photo sent!", { id: toastId });
    } catch (err: any) {
      console.error("Failed to send image:", err);
      toast.error("Failed to send photo: " + err.message, { id: toastId });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Voice Notes
  const startRecording = async () => {
    if (isBlocked) {
      toast.error("Unblock user to record voice notes.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Mic access error:", err);
      toast.error("Microphone access denied.");
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || !chatId || !user) return;

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const duration = recordingSeconds;

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        try {
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId: user.uid,
            senderName: myName,
            audioUrl: base64Audio,
            duration,
            type: 'audio',
            seen: false,
            createdAt: serverTimestamp()
          });

          syncConversations('🎙️ Voice note', 'audio');

          if (activeUser?.uid) {
            setDoc(doc(db, 'users', activeUser.uid, 'inbox', user.uid), {
              senderId: user.uid,
              senderName: myName,
              senderUsername: myUsername,
              senderPhotoURL: myPhoto,
              text: '🎙️ Voice note',
              timestamp: Date.now()
            }, { merge: true }).catch(() => {});
          }

          toast.success("Voice note sent!");
        } catch (err: any) {
          toast.error("Failed to send voice note: " + err.message);
        }
      };
    };

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!chatId) return;
    setSelectedMessageId(null);
    try {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', msgId));
      toast.success("Message deleted");
    } catch (err: any) {
      toast.error("Could not delete message: " + err.message);
    }
  };

  const handleCopyMessage = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setSelectedMessageId(null);
    toast.success("Copied to clipboard", { duration: 1200 });
  };

  const handleStartEdit = (msg: Message) => {
    if (!msg.text) return;
    setEditingMessage(msg);
    setReplyingTo(null);
    setInputText(msg.text);
    setSelectedMessageId(null);
  };

  const handleReact = async (msgId: string, emoji: string) => {
    if (!chatId) return;
    setShowReactionPickerFor(null);
    setSelectedMessageId(null);
    try {
      const target = messages.find((m) => m.id === msgId);
      const nextReaction = target?.reaction === emoji ? '' : emoji;
      await updateDoc(doc(db, 'chats', chatId, 'messages', msgId), { reaction: nextReaction });
    } catch (err: any) {
      console.error("Reaction failed:", err);
    }
  };

  // Clear all messages in current chat
  const handleClearChat = async () => {
    if (!chatId || messages.length === 0) return;
    setShowMenu(false);
    if (!window.confirm("Clear all messages in this conversation?")) return;
    try {
      const batch = writeBatch(db);
      messages.forEach((m) => {
        batch.delete(doc(db, 'chats', chatId, 'messages', m.id));
      });
      await batch.commit();
      toast.success("Chat cleared");
    } catch (err: any) {
      toast.error("Could not clear chat: " + err.message);
    }
  };

  // Toggle Mute Notifications
  const toggleMute = () => {
    if (!chatId) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem(`chatwave_muted_${chatId}`, String(newMuted));
    toast.success(newMuted ? "Notifications muted" : "Notifications unmuted");
    setShowMenu(false);
  };

  // Toggle Block User
  const toggleBlock = async () => {
    if (!user || !activeUser?.uid) return;
    const newBlocked = !isBlocked;
    setIsBlocked(newBlocked);
    setShowMenu(false);

    try {
      const blockRef = doc(db, 'users', user.uid, 'blockedUsers', activeUser.uid);
      if (newBlocked) {
        await setDoc(blockRef, { blockedAt: new Date().toISOString() });
        toast.success(`Blocked @${activeUser.username || 'user'}`);
      } else {
        await deleteDoc(blockRef);
        toast.success(`Unblocked @${activeUser.username || 'user'}`);
      }
    } catch (e: any) {
      setIsBlocked(!newBlocked);
      toast.error("Failed to update block: " + e.message);
    }
  };

  const formatMessageTime = (createdAt: any) => {
    if (!createdAt) return 'Just now';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageDateLabel = (createdAt: any) => {
    if (!createdAt) return null;
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) return 'Today';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const presenceDisplay = formatPresence(liveUserData?.isOnline, liveUserData?.lastSeen, liveUserData?.hideLastSeen);

  // Filter messages if in-chat search is active
  const displayedMessages = chatSearchQuery.trim()
    ? messages.filter((m) => (m.text || '').toLowerCase().includes(chatSearchQuery.trim().toLowerCase()))
    : messages;

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-background/40 relative select-none">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageSelect} 
        accept="image/*" 
        className="hidden" 
        disabled={isUploadingImage}
      />

      {/* =======================================================
          TOP HEADER BAR (Fixed / Sticky at Top)
          ======================================================= */}
      <div className="flex-shrink-0 p-3 md:p-3.5 border-b border-white/10 flex items-center justify-between bg-surface/90 backdrop-blur-2xl z-20 shadow-md">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
          <button 
            onClick={onBack} 
            className="p-2 -ml-1 rounded-full hover:bg-white/10 text-white transition-colors flex-shrink-0"
            title="Back to contacts"
          >
            <ArrowLeft size={21} />
          </button>
          
          {/* Clickable Profile Info */}
          <div 
            onClick={onViewProfile} 
            className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden border-2 border-primary/50 group-hover:scale-105 transition-transform shadow-md">
                {liveUserData?.photoURL ? (
                  <img src={liveUserData.photoURL} alt={liveUserData.name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-full h-full p-2 text-primary" />
                )}
              </div>
              <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-surface rounded-full ${
                liveUserData?.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
              }`}></span>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-text text-sm sm:text-base group-hover:text-primary transition-colors truncate">
                {liveUserData?.name || 'User'}
              </h3>
              {isOtherTyping ? (
                <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1 animate-pulse">
                  <span>typing</span>
                  <span className="inline-block animate-bounce">.</span>
                  <span className="inline-block animate-bounce delay-100">.</span>
                  <span className="inline-block animate-bounce delay-200">.</span>
                </p>
              ) : (
                <p className="text-xs text-text-secondary truncate">
                  {presenceDisplay || `@${liveUserData?.username || 'user'}`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ml-2 relative">
          <button
            onClick={() => {
              setShowChatSearch((prev) => !prev);
              setChatSearchQuery('');
            }}
            className={`p-2.5 rounded-full transition-all active:scale-95 ${
              showChatSearch
                ? 'bg-primary text-white shadow'
                : 'bg-white/5 hover:bg-primary/20 text-text-secondary hover:text-primary'
            }`}
            title="Search in conversation"
          >
            <Search size={17} />
          </button>

          <button
            onClick={() => onStartCall('audio')}
            className="p-2.5 rounded-full bg-white/5 hover:bg-primary/20 text-text hover:text-primary transition-all active:scale-95"
            title="Voice Call"
          >
            <Phone size={18} />
          </button>

          <button
            onClick={() => onStartCall('video')}
            className="p-2.5 rounded-full bg-white/5 hover:bg-primary/20 text-text hover:text-primary transition-all active:scale-95"
            title="Video Call"
          >
            <Video size={18} />
          </button>

          {/* Three-Dot Menu */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2.5 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
            title="More Options"
          >
            <MoreVertical size={18} />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute top-12 right-0 w-52 bg-surface/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-1.5 z-50 text-xs text-text animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => { setShowMenu(false); onViewProfile(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <UserCheck size={16} className="text-primary" /> View Profile
              </button>
              <button
                onClick={toggleMute}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                {isMuted ? <Bell size={16} className="text-emerald-400" /> : <BellOff size={16} />}
                {isMuted ? 'Unmute Chat' : 'Mute Notifications'}
              </button>
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-text-secondary hover:text-white transition-colors text-left"
                >
                  <Trash2 size={16} /> Clear Chat History
                </button>
              )}
              <button
                onClick={() => { setShowMenu(false); setShowReportModal(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-amber-400 transition-colors text-left"
              >
                <AlertTriangle size={16} /> Report User
              </button>
              <div className="my-1 border-t border-white/10" />
              <button
                onClick={toggleBlock}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors text-left font-semibold"
              >
                <Ban size={16} /> {isBlocked ? 'Unblock User' : 'Block User'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible In-Chat Search Bar */}
      {showChatSearch && (
        <div className="flex-shrink-0 px-3.5 py-2 bg-surface/95 border-b border-white/10 flex items-center gap-2 z-10 animate-in slide-in-from-top-2 duration-150">
          <Search size={15} className="text-primary flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            placeholder="Search messages in this chat..."
            className="flex-1 bg-transparent text-xs text-text placeholder:text-text-secondary focus:outline-none"
          />
          {chatSearchQuery && (
            <span className="text-[10px] text-text-secondary font-mono">
              {displayedMessages.length} match{displayedMessages.length === 1 ? '' : 'es'}
            </span>
          )}
          <button
            onClick={() => {
              setShowChatSearch(false);
              setChatSearchQuery('');
            }}
            className="p-1 rounded-full hover:bg-white/10 text-text-secondary hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Blocked User Warning Banner */}
      {isBlocked && (
        <div className="flex-shrink-0 p-2.5 bg-red-500/15 border-b border-red-500/30 flex items-center justify-between px-4 text-xs text-red-300">
          <span className="flex items-center gap-1.5">
            <Ban size={14} /> You have blocked this user.
          </span>
          <button
            onClick={toggleBlock}
            className="underline font-bold hover:text-white"
          >
            Unblock
          </button>
        </div>
      )}

      {/* =======================================================
          MESSAGES SCROLL AREA
          ======================================================= */}
      <div 
        onClick={() => {
          setSelectedMessageId(null);
          setShowReactionPickerFor(null);
          setShowMenu(false);
        }}
        className="flex-1 overflow-y-auto overscroll-contain p-2.5 sm:p-4 space-y-2 min-h-0 w-full"
      >
        {isPrivateLocked ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shadow-xl">
              <Lock size={36} className="text-primary" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-lg font-bold text-text">This Account is Private</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                @{liveUserData?.username || activeUser?.username} has set their account to private. Follow them to connect and send messages.
              </p>
            </div>
            <button
              onClick={handleFollowFromChat}
              disabled={followingLoading}
              className="px-6 py-2.5 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl text-sm shadow-lg flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              <UserPlus size={16} /> Follow @{liveUserData?.username || activeUser?.username}
            </button>
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-text-secondary opacity-70 p-8 space-y-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Smile size={32} className="text-primary" />
            </div>
            <p className="font-semibold text-text">
              {chatSearchQuery ? 'No matching messages' : 'No messages yet'}
            </p>
            <p className="text-xs max-w-xs">
              {chatSearchQuery
                ? `No messages containing "${chatSearchQuery}"`
                : `Say hello, share a photo, or start an HD call with ${liveUserData?.name}!`}
            </p>
          </div>
        ) : (
          displayedMessages.map((msg, index) => {
            const isMe = msg.senderId === user?.uid;
            const isSelected = selectedMessageId === msg.id;
            
            const currentDateLabel = getMessageDateLabel(msg.createdAt);
            const prevMessage = index > 0 ? displayedMessages[index - 1] : null;
            const prevDateLabel = prevMessage ? getMessageDateLabel(prevMessage.createdAt) : null;
            const showDateDivider = currentDateLabel && currentDateLabel !== prevDateLabel;

            return (
              <div key={msg.id} className="w-full flex flex-col">
                {showDateDivider && (
                  <div className="w-full flex justify-center my-3">
                    <span className="px-3 py-1 bg-surface/80 border border-white/10 rounded-full text-[11px] font-semibold text-text-secondary shadow-sm backdrop-blur-md">
                      {currentDateLabel}
                    </span>
                  </div>
                )}

                {/* Message Row */}
                <div className={`w-full flex ${isMe ? 'justify-end' : 'justify-start'} group my-0.5`}>
                  <div className={`flex items-end gap-1.5 max-w-[86%] sm:max-w-[72%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* Message Bubble (Tappable on Mobile to reveal quick actions) */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMessageId(isSelected ? null : msg.id);
                      }}
                      className={`relative rounded-2xl text-sm shadow-md break-words transition-all cursor-pointer ${
                        isMe 
                          ? 'bg-gradient-to-br from-primary to-secondary text-white rounded-br-sm shadow-primary/15' 
                          : 'bg-surface/90 text-text border border-white/10 rounded-bl-sm'
                      } ${msg.type === 'image' ? 'p-1.5' : 'px-3.5 py-2 sm:px-4 sm:py-2.5'} ${
                        isSelected ? 'ring-2 ring-white/40' : ''
                      }`}
                    >
                      {/* Reply Quote context */}
                      {msg.replyTo && (
                        <div className={`text-xs px-2.5 py-1 mb-1.5 rounded-lg bg-black/25 border-l-2 border-white/80 truncate ${isMe ? 'text-white/95' : 'text-text-secondary'}`}>
                          <span className="font-bold">{msg.replyTo.senderName}: </span>
                          <span>{msg.replyTo.text}</span>
                        </div>
                      )}

                      {/* Image Message */}
                      {msg.type === 'image' && msg.imageUrl && (
                        <div 
                          className="relative group/img cursor-pointer" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(msg.imageUrl || null);
                          }}
                        >
                          <img 
                            src={msg.imageUrl} 
                            alt="Shared Photo" 
                            className="max-h-72 w-full object-cover rounded-xl shadow"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                            <Maximize2 size={24} className="text-white drop-shadow" />
                          </div>
                        </div>
                      )}

                      {/* Audio Voice Note Message */}
                      {msg.type === 'audio' && msg.audioUrl && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <VoiceMessagePlayer audioUrl={msg.audioUrl} isMe={isMe} />
                        </div>
                      )}

                      {/* Text Message Content */}
                      {msg.text && (
                        <p className={msg.type === 'image' ? 'px-2.5 py-1.5 text-xs' : 'leading-relaxed'}>{msg.text}</p>
                      )}

                      {/* Timestamp, Edited Tag & Double Tick (Seen Status) */}
                      <div className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 font-mono ${isMe ? 'text-white/80' : 'text-text-secondary'}`}>
                        {msg.isEdited && <span className="italic opacity-80 mr-0.5">(edited)</span>}
                        <span>{formatMessageTime(msg.createdAt)}</span>
                        {isMe && (
                          <span title={msg.seen ? 'Seen' : 'Delivered'}>
                            {msg.seen ? (
                              <CheckCheck size={14} className="text-sky-200 font-bold" />
                            ) : (
                              <CheckCheck size={14} className="text-white/55" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Emoji Reaction Badge */}
                      {msg.reaction && (
                        <div className="absolute -bottom-2.5 right-2 bg-surface border border-white/25 rounded-full px-1.5 py-0.5 text-xs shadow-lg z-10">
                          {msg.reaction}
                        </div>
                      )}
                    </div>

                    {/* Action buttons (Visible on Hover on Desktop OR Tap on Mobile!) */}
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className={`${
                        isSelected ? 'opacity-100 flex' : 'opacity-0 group-hover:opacity-100 hidden sm:flex'
                      } items-center gap-0.5 transition-opacity pb-1 bg-surface/80 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none px-1.5 py-0.5 rounded-full border border-white/10 sm:border-none`}
                    >
                      <button 
                        onClick={() => setShowReactionPickerFor(showReactionPickerFor === msg.id ? null : msg.id)}
                        className="p-1.5 hover:bg-white/10 rounded-full text-text-secondary hover:text-white"
                        title="React"
                      >
                        <Smile size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          setReplyingTo(msg);
                          setEditingMessage(null);
                          setSelectedMessageId(null);
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-full text-text-secondary hover:text-white"
                        title="Reply"
                      >
                        <Reply size={14} />
                      </button>
                      {msg.text && (
                        <button
                          onClick={() => handleCopyMessage(msg.text)}
                          className="p-1.5 hover:bg-white/10 rounded-full text-text-secondary hover:text-white"
                          title="Copy text"
                        >
                          <Copy size={13} />
                        </button>
                      )}
                      {isMe && msg.type === 'text' && (
                        <button
                          onClick={() => handleStartEdit(msg)}
                          className="p-1.5 hover:bg-white/10 rounded-full text-text-secondary hover:text-primary"
                          title="Edit message"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {isMe && (
                        <button 
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-full"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reaction Picker Overlay */}
                {showReactionPickerFor === msg.id && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className={`my-1 p-1.5 bg-surface/95 backdrop-blur-xl border border-white/20 rounded-full flex gap-1.5 shadow-2xl z-20 ${isMe ? 'self-end mr-4' : 'self-start ml-4'}`}
                  >
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReact(msg.id, emoji)}
                        className="p-1 hover:scale-125 active:scale-95 transition-transform text-base"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Edit or Reply Banner */}
      {(replyingTo || editingMessage) && (
        <div className="flex-shrink-0 px-4 py-2 bg-surface/95 border-t border-white/10 flex items-center justify-between text-xs z-10">
          <div className="truncate flex items-center gap-2">
            {editingMessage ? (
              <>
                <Edit2 size={14} className="text-primary flex-shrink-0" />
                <span className="text-primary font-semibold">Editing message:</span>
                <span className="italic truncate text-text-secondary">{editingMessage.text}</span>
              </>
            ) : (
              <>
                <Reply size={14} className="text-primary flex-shrink-0" />
                <span className="text-text-secondary">Replying to <b className="text-text">{replyingTo?.senderName}</b>:</span>
                <span className="italic truncate text-text-secondary">
                  {replyingTo?.text || (replyingTo?.imageUrl ? 'Photo' : 'Voice Message')}
                </span>
              </>
            )}
          </div>
          <button 
            onClick={() => {
              setReplyingTo(null);
              if (editingMessage) {
                setEditingMessage(null);
                setInputText('');
              }
            }} 
            className="p-1 hover:bg-white/10 rounded-full"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Quick Emoji Drawer */}
      {showEmojiDrawer && (
        <div className="flex-shrink-0 px-3 py-2 bg-surface/95 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar z-10">
          {EMOJI_PALETTE.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setInputText((prev) => prev + emoji)}
              className="p-1.5 text-lg hover:bg-white/10 rounded-xl transition-transform active:scale-125 flex-shrink-0"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* =======================================================
          BOTTOM INPUT BAR (Fixed at Bottom with Safe Area)
          ======================================================= */}
      <div className="flex-shrink-0 p-2.5 sm:p-3 border-t border-white/10 bg-surface/90 backdrop-blur-2xl z-20 pb-safe">
        {isBlocked ? (
          <div className="text-center p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
            You cannot send messages to a blocked user.
          </div>
        ) : isPrivateLocked ? (
          <div className="flex items-center justify-between gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-text min-w-0">
              <Lock size={16} className="text-primary flex-shrink-0" />
              <span className="truncate">
                <strong className="text-primary">@{liveUserData?.username || activeUser?.username}</strong>'s account is private. Follow to chat.
              </span>
            </div>
            <button
              type="button"
              onClick={handleFollowFromChat}
              disabled={followingLoading}
              className="px-4 py-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-semibold rounded-xl text-xs transition-transform active:scale-95 shadow-md flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
            >
              <UserPlus size={14} /> Follow
            </button>
          </div>
        ) : isRecording ? (
          /* Voice Recording Bar */
          <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2 animate-pulse">
            <div className="flex items-center gap-2.5 text-red-400">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
              <span className="font-semibold text-sm">Recording...</span>
              <span className="font-mono text-sm font-bold ml-2">
                0:{recordingSeconds < 10 ? '0' : ''}{recordingSeconds}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-2 rounded-full hover:bg-white/10 text-text-secondary hover:text-red-400 transition-colors"
                title="Cancel"
              >
                <Trash2 size={18} />
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="p-2.5 rounded-full bg-primary text-white hover:opacity-90 shadow-lg active:scale-95 transition-transform"
                title="Send voice note"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* Standard Input Bar */
          <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowEmojiDrawer((prev) => !prev)}
              className={`p-2.5 sm:p-3 rounded-xl transition-colors flex-shrink-0 ${
                showEmojiDrawer
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-white/10 hover:bg-white/15 text-text-secondary hover:text-primary'
              }`}
              title="Emoji Picker"
            >
              <Smile size={18} />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="p-2.5 sm:p-3 rounded-xl bg-white/10 hover:bg-white/15 text-text-secondary hover:text-primary transition-colors flex-shrink-0 disabled:opacity-40"
              title="Send Photo"
            >
              <Paperclip size={18} />
            </button>

            <input 
              type="text"
              placeholder={editingMessage ? "Edit your message..." : "Type a message..."}
              value={inputText}
              onChange={handleInputChange}
              className="flex-1 px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:border-primary text-text placeholder:text-white/50 text-sm shadow-inner min-w-0"
            />

            {inputText.trim() ? (
              <button 
                type="submit"
                className="p-2.5 sm:p-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg flex-shrink-0"
                title={editingMessage ? "Save Edit" : "Send"}
              >
                {editingMessage ? <Check size={18} /> : <Send size={18} />}
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="p-2.5 sm:p-3 bg-white/10 hover:bg-primary/20 text-text-secondary hover:text-primary rounded-xl transition-all shadow active:scale-95 flex-shrink-0"
                title="Record voice note"
              >
                <Mic size={18} />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Fullscreen Lightbox Preview */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            onClick={() => setPreviewImage(null)}
            className="absolute top-5 right-5 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Close"
          >
            <X size={24} />
          </button>
          <img 
            src={previewImage} 
            alt="Enlarged Preview" 
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <ReportUserModal
          targetUser={liveUserData}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
