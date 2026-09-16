import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { 
  playNotificationSound, 
  showSystemNotification, 
  requestNotificationPermission 
} from '../utils/notification';
import toast from 'react-hot-toast';

interface UseGlobalNotificationsProps {
  activeChatUid: string | null;
  onSelectChat: (chatUser: any) => void;
}

export function useGlobalNotifications({ activeChatUid, onSelectChat }: UseGlobalNotificationsProps) {
  const { user } = useAuthStore();
  const isInitialLoad = useRef(true);
  const activeChatUidRef = useRef(activeChatUid);
  activeChatUidRef.current = activeChatUid;

  // Request browser notification permissions on mount
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  // Listen to incoming messages in real-time across all chats
  useEffect(() => {
    if (!user?.uid) return;

    const inboxCol = collection(db, 'users', user.uid, 'inbox');
    const q = query(inboxCol);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Ignore initial snapshot population to prevent burst of alerts on load
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          const senderId = data.senderId;

          // Don't notify if sent by current user
          if (senderId === user.uid) return;

          // Check if message is within the last 45 seconds (fresh message)
          const now = Date.now();
          const msgTime = data.timestamp || 0;
          if (now - msgTime > 45000) return;

          // If document is hidden or user is not currently in this chat
          const isCurrentChat = activeChatUidRef.current === senderId;
          const isBackgrounded = document.hidden;

          if (!isCurrentChat || isBackgrounded) {
            playNotificationSound();
            showSystemNotification(
              data.senderName || 'ChatWave Message',
              data.text || (data.imageUrl ? '📷 Sent a photo' : '🎙️ Sent a voice note'),
              data.senderPhotoURL || '/favicon.svg',
              () => {
                onSelectChat({
                  uid: senderId,
                  name: data.senderName,
                  username: data.senderUsername,
                  photoURL: data.senderPhotoURL
                });
              }
            );

            // Also show an interactive in-app toast banner if app is open
            if (!isBackgrounded) {
              toast.custom((t) => (
                <div 
                  onClick={() => {
                    toast.dismiss(t.id);
                    onSelectChat({
                      uid: senderId,
                      name: data.senderName,
                      username: data.senderUsername,
                      photoURL: data.senderPhotoURL
                    });
                  }}
                  className={`max-w-md w-full bg-surface/95 border border-primary/40 shadow-2xl rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:border-primary transition-all backdrop-blur-xl ${
                    t.visible ? 'animate-in fade-in slide-in-from-top-4' : 'animate-out fade-out'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex-shrink-0 overflow-hidden border border-white/10 flex items-center justify-center">
                    {data.senderPhotoURL ? (
                      <img src={data.senderPhotoURL} alt={data.senderName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary font-bold text-sm">{(data.senderName || 'U').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-text truncate flex items-center gap-1.5">
                      <span>{data.senderName || 'New Message'}</span>
                      <span className="text-[10px] text-text-secondary font-normal">now</span>
                    </p>
                    <p className="text-xs text-text-secondary truncate mt-0.5">
                      {data.text || (data.imageUrl ? '📷 Sent a photo' : '🎙️ Sent a voice note')}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold flex-shrink-0 shadow">
                    Open
                  </span>
                </div>
              ), { duration: 4500 });
            }
          }
        }
      });
    }, (err) => {
      console.warn("Global notification listener error:", err);
    });

    return () => unsubscribe();
  }, [user?.uid, onSelectChat]);
}
