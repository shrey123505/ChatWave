import { useEffect, useRef } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { 
  playNotificationSound, 
  showSystemNotification, 
  requestNotificationPermission 
} from '../utils/notification';

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
              data.text || 'Sent a new message',
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
          }
        }
      });
    }, (err) => {
      console.warn("Global notification listener error:", err);
    });

    return () => unsubscribe();
  }, [user?.uid, onSelectChat]);
}
