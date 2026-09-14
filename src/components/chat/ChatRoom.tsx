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
  updateDoc
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
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  reaction?: string;
}

const QUICK_REACTIONS = ['❤️', '👍', '😂', '🔥', '👏', '😮'];

export default function ChatRoom({ 
  activeUser, 
  onBack, 
  onViewProfile 
}: { 
  activeUser: any; 
  onBack: () => void; 
  onViewProfile: () => void;
}) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showReactionPickerFor, setShowReactionPickerFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Deterministic chatId between current user and activeUser
  const chatId = user?.uid && activeUser?.uid
    ? [user.uid, activeUser.uid].sort().join('_')
    : null;

  // Real-time Firestore Listener
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
      setMessages(msgs);
    }, (err) => {
      console.error("Firestore message listener error:", err);
      toast.error("Real-time sync error: " + err.message);
    });

    return () => unsubscribe();
  }, [chatId]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || !chatId || !user) return;

    setInputText('');
    const replySnapshot = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      senderName: replyingTo.senderName
    } : null;
    setReplyingTo(null);

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || 'You',
        text: trimmed,
        replyTo: replySnapshot,
        createdAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send: " + err.message);
    }
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

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 relative">
      {/* Chat Header */}
      <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-surface/60 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="md:hidden p-2 rounded-full hover:bg-white/10 text-white transition-colors"
            title="Back to contacts"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div 
            onClick={onViewProfile} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden border border-white/10 flex-shrink-0">
              {activeUser.photoURL ? (
                <img src={activeUser.photoURL} alt={activeUser.name} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-full h-full p-2 text-primary group-hover:scale-110 transition-transform" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-text group-hover:text-primary transition-colors flex items-center gap-2">
                {activeUser.name || 'User'}
              </h3>
              <p className="text-xs text-text-secondary">@{activeUser.username || 'user'} • Tap for profile</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-text-secondary opacity-60 p-8 space-y-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Smile size={32} className="text-primary" />
            </div>
            <p className="font-semibold text-text">No messages yet</p>
            <p className="text-xs max-w-xs">Send a message to say hello to {activeUser.name}!</p>
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
                    className={`relative px-4 py-2.5 rounded-2xl text-sm shadow-md break-words ${
                      isMe 
                        ? 'bg-gradient-to-r from-primary to-secondary text-white rounded-br-none' 
                        : 'bg-surface/80 text-text border border-white/10 rounded-bl-none'
                    }`}
                  >
                    <p>{msg.text}</p>

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
        <div className="px-4 py-2 bg-surface/90 border-t border-white/10 flex items-center justify-between text-xs">
          <div className="truncate flex items-center gap-2">
            <Reply size={14} className="text-primary" />
            <span className="text-text-secondary">Replying to <b className="text-text">{replyingTo.senderName}</b>:</span>
            <span className="italic truncate text-text-secondary">{replyingTo.text}</span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 rounded-full">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-surface/50 backdrop-blur-md flex items-center gap-2">
        <input 
          type="text"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 px-4 py-3 bg-white/10 border border-white/15 rounded-xl focus:outline-none focus:border-primary text-text placeholder:text-white/50 text-sm shadow-inner"
        />
        <button 
          type="submit"
          disabled={!inputText.trim()}
          className="p-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg flex-shrink-0"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
