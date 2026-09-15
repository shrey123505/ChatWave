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
  setDoc
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
  Info,
  Paperclip,
  Mic,
  CheckCheck,
  Maximize2,
  Phone,
  Video
} from 'lucide-react';
import { compressImage } from '../../utils/imageCompressor';
import { playNotificationSound, showSystemNotification, requestNotificationPermission } from '../../utils/notification';
import VoiceMessagePlayer from './VoiceMessagePlayer';
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
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showReactionPickerFor, setShowReactionPickerFor] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Typing Indicator States
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitialLoad = useRef(true);

  // Ask for notification permissions on first chat mount
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  // Deterministic chatId between current user and activeUser
  const chatId = user?.uid && activeUser?.uid
    ? [user.uid, activeUser.uid].sort().join('_')
    : null;

  // 1. Real-time Firestore Listener for Messages
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

      // Check if new incoming message arrived to play notification sound
      if (!isInitialLoad.current && snapshot.docChanges().some(change => change.type === 'added' && change.doc.data().senderId === activeUser.uid)) {
        playNotificationSound();
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

  // 2. Real-time Listener for Other User's Typing Indicator
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

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

  // 3. Send Text Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || !chatId || !user) return;

    setInputText('');
    stopTypingImmediate();

    const replySnapshot = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text || (replyingTo.imageUrl ? 'Photo' : 'Voice Message'),
      senderName: replyingTo.senderName
    } : null;
    setReplyingTo(null);

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || 'You',
        text: trimmed,
        type: 'text',
        seen: false,
        replyTo: replySnapshot,
        createdAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send: " + err.message);
    }
  };

  // 4. Send Image Message
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;

    setIsUploadingImage(true);
    const toastId = toast.loading("Sending photo...");

    try {
      const compressedBase64 = await compressImage(file, 800, 800, 0.7);

      const replySnapshot = replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text || (replyingTo.imageUrl ? 'Photo' : 'Voice Message'),
        senderName: replyingTo.senderName
      } : null;
      setReplyingTo(null);

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || 'You',
        imageUrl: compressedBase64,
        type: 'image',
        seen: false,
        replyTo: replySnapshot,
        createdAt: serverTimestamp()
      });

      toast.success("Photo sent!", { id: toastId });
    } catch (err: any) {
      console.error("Failed to send image:", err);
      toast.error("Failed to send photo: " + err.message, { id: toastId });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 5. Voice Notes (MediaRecorder)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Mic access error:", err);
      toast.error("Microphone access denied. Please allow mic permissions.");
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
            senderName: user.displayName || 'You',
            audioUrl: base64Audio,
            duration,
            type: 'audio',
            seen: false,
            createdAt: serverTimestamp()
          });
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
    try {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', msgId));
      toast.success("Message deleted");
    } catch (err: any) {
      toast.error("Could not delete message: " + err.message);
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    if (!chatId) return;
    setShowReactionPickerFor(null);
    try {
      await updateDoc(doc(db, 'chats', chatId, 'messages', msgId), {
        reaction: emoji
      });
    } catch (err: any) {
      console.error("Reaction failed:", err);
    }
  };

  const formatMessageTime = (createdAt: any) => {
    if (!createdAt) return '';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-background/50 relative">
      {/* Hidden File Input for Image Uploads */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageSelect} 
        accept="image/*" 
        className="hidden" 
        disabled={isUploadingImage}
      />

      {/* =======================================================
          TOP HEADER BAR (Fixed / Sticky with Phone & Video Call)
          ======================================================= */}
      <div className="flex-shrink-0 p-3 md:p-3.5 border-b border-white/10 flex items-center justify-between bg-surface/85 backdrop-blur-xl z-20 shadow-md">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
          <button 
            onClick={onBack} 
            className="p-2 -ml-1 rounded-full hover:bg-white/10 text-white transition-colors flex-shrink-0"
            title="Back to contacts"
          >
            <ArrowLeft size={22} />
          </button>
          
          {/* Clickable Profile Info */}
          <div 
            onClick={onViewProfile} 
            className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden border-2 border-primary/50 group-hover:scale-105 transition-transform">
                {activeUser.photoURL ? (
                  <img src={activeUser.photoURL} alt={activeUser.name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-full h-full p-2 text-primary" />
                )}
              </div>
              <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-surface rounded-full ${
                isOtherTyping ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500'
              }`}></span>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-text text-sm sm:text-base group-hover:text-primary transition-colors truncate">
                {activeUser.name || 'User'}
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
                  @{activeUser.username || 'user'} • <span className="text-primary hover:underline">View Profile</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Actions: Call, Video, Info */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ml-2">
          {/* Audio Call Button */}
          <button
            onClick={() => onStartCall('audio')}
            className="p-2.5 rounded-full bg-white/5 hover:bg-primary/20 text-text hover:text-primary transition-all active:scale-95"
            title="Start Audio Call"
          >
            <Phone size={18} />
          </button>

          {/* Video Call Button */}
          <button
            onClick={() => onStartCall('video')}
            className="p-2.5 rounded-full bg-white/5 hover:bg-primary/20 text-text hover:text-primary transition-all active:scale-95"
            title="Start Video Call"
          >
            <Video size={18} />
          </button>

          {/* Profile Info Button */}
          <button
            onClick={onViewProfile}
            className="p-2.5 rounded-full hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
            title="Profile Info"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* =======================================================
          MESSAGES SCROLL AREA (Only This Area Scrolls!)
          ======================================================= */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-text-secondary opacity-60 p-8 space-y-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Smile size={32} className="text-primary" />
            </div>
            <p className="font-semibold text-text">No messages yet</p>
            <p className="text-xs max-w-xs">Say hello, share a photo, or start a call with {activeUser.name}!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
              >
                {/* Reply context quote */}
                {msg.replyTo && (
                  <div className={`text-xs px-3 py-1 mb-1 rounded-lg max-w-xs bg-white/5 border-l-2 border-primary text-text-secondary truncate ${isMe ? 'mr-2' : 'ml-2'}`}>
                    <span className="font-semibold text-primary">{msg.replyTo.senderName}: </span>
                    {msg.replyTo.text}
                  </div>
                )}

                <div className="flex items-center gap-1 max-w-[85%] sm:max-w-md">
                  {/* Actions for other user's message (left aligned) */}
                  {!isMe && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      <button 
                        onClick={() => setShowReactionPickerFor(showReactionPickerFor === msg.id ? null : msg.id)}
                        className="p-1.5 hover:bg-white/10 rounded-full text-text-secondary"
                        title="React"
                      >
                        <Smile size={15} />
                      </button>
                      <button 
                        onClick={() => setReplyingTo(msg)}
                        className="p-1.5 hover:bg-white/10 rounded-full text-text-secondary"
                        title="Reply"
                      >
                        <Reply size={15} />
                      </button>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div 
                    className={`relative rounded-2xl text-sm shadow-md break-words transition-all ${
                      isMe 
                        ? 'bg-gradient-to-r from-primary to-secondary text-white rounded-br-none' 
                        : 'bg-surface/80 text-text border border-white/10 rounded-bl-none'
                    } ${msg.type === 'image' ? 'p-1.5' : 'px-4 py-2.5'}`}
                  >
                    {/* Image Message */}
                    {msg.type === 'image' && msg.imageUrl && (
                      <div className="relative group/img cursor-pointer" onClick={() => setPreviewImage(msg.imageUrl || null)}>
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
                      <VoiceMessagePlayer audioUrl={msg.audioUrl} isMe={isMe} />
                    )}

                    {/* Text Message Content */}
                    {msg.text && (
                      <p className={msg.type === 'image' ? 'px-2.5 py-1.5 text-xs' : ''}>{msg.text}</p>
                    )}

                    {/* Timestamp & Double Tick (Seen Status) */}
                    <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${isMe ? 'text-white/80' : 'text-text-secondary'}`}>
                      <span>{formatMessageTime(msg.createdAt)}</span>
                      {isMe && (
                        <span title={msg.seen ? 'Seen' : 'Delivered'}>
                          {msg.seen ? (
                            <CheckCheck size={14} className="text-sky-300 font-bold" />
                          ) : (
                            <CheckCheck size={14} className="text-white/50" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* Emoji Reaction Badge */}
                    {msg.reaction && (
                      <div className="absolute -bottom-2 right-2 bg-surface border border-white/20 rounded-full px-1.5 py-0.5 text-xs shadow-lg">
                        {msg.reaction}
                      </div>
                    )}
                  </div>

                  {/* Actions for my message (right aligned) */}
                  {isMe && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      <button 
                        onClick={() => setShowReactionPickerFor(showReactionPickerFor === msg.id ? null : msg.id)}
                        className="p-1.5 hover:bg-white/10 rounded-full text-text-secondary"
                        title="React"
                      >
                        <Smile size={15} />
                      </button>
                      <button 
                        onClick={() => setReplyingTo(msg)}
                        className="p-1.5 hover:bg-white/10 rounded-full text-text-secondary"
                        title="Reply"
                      >
                        <Reply size={15} />
                      </button>
                      <button 
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-full transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Reaction Picker Overlay */}
                {showReactionPickerFor === msg.id && (
                  <div className={`mt-1 p-1 bg-surface border border-white/20 rounded-full flex gap-1 shadow-2xl z-20 ${isMe ? 'mr-4' : 'ml-4'}`}>
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReact(msg.id, emoji)}
                        className="p-1 hover:scale-125 transition-transform text-base"
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

      {/* Reply Banner */}
      {replyingTo && (
        <div className="flex-shrink-0 px-4 py-2 bg-surface/90 border-t border-white/10 flex items-center justify-between text-xs z-10">
          <div className="truncate flex items-center gap-2">
            <Reply size={14} className="text-primary" />
            <span className="text-text-secondary">Replying to <b className="text-text">{replyingTo.senderName}</b>:</span>
            <span className="italic truncate text-text-secondary">
              {replyingTo.text || (replyingTo.imageUrl ? 'Photo' : 'Voice Message')}
            </span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 rounded-full">
            <X size={14} />
          </button>
        </div>
      )}

      {/* =======================================================
          BOTTOM INPUT BAR (Fixed / Sticky at Bottom of Chat)
          ======================================================= */}
      <div className="flex-shrink-0 p-2.5 sm:p-3 border-t border-white/10 bg-surface/85 backdrop-blur-xl z-20">
        {isRecording ? (
          /* Voice Recording Active Bar */
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
                title="Cancel recording"
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
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            {/* Attach Image Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="p-2.5 sm:p-3 rounded-xl bg-white/10 hover:bg-white/15 text-text-secondary hover:text-primary transition-colors flex-shrink-0 disabled:opacity-40"
              title="Send Photo"
            >
              <Paperclip size={18} />
            </button>

            {/* Message Input Box */}
            <input 
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={handleInputChange}
              className="flex-1 px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:border-primary text-text placeholder:text-white/50 text-sm shadow-inner"
            />

            {/* Action Button: Send or Mic */}
            {inputText.trim() ? (
              <button 
                type="submit"
                className="p-2.5 sm:p-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg flex-shrink-0"
                title="Send message"
              >
                <Send size={18} />
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

      {/* Fullscreen Image Preview Lightbox */}
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
    </div>
  );
}
