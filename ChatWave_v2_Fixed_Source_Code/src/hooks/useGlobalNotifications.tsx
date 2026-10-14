import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { 
  playNotificationSound, 
  showSystemNotification, 
  requestNotificationPermission 
} from '../utils/notification';
import { X } from 'lucide-react';
import toast, { Toaster, ToastBar, useToasterStore } from 'react-hot-toast';

/**
 * Global Swipeable & Queue-Limited Toaster
 * - Enforces a strict maximum of 1 visible flash notification at a time (prevents 2-4 stacking up)
 * - Allows instant touch/mouse swipe-to-dismiss (up, left, or right) and tap-to-close
 * - Uses a snappy 2.0s default duration so notifications never linger annoyingly
 */
export function SwipeableToaster() {
  const { toasts } = useToasterStore();

  // Enforce a strict limit of 1 visible toast at a time
  useEffect(() => {
    const visibleToasts = toasts.filter((t) => t.visible);
    if (visibleToasts.length > 1) {
      visibleToasts
        .slice(1)
        .forEach((oldToast) => toast.dismiss(oldToast.id));
    }
  }, [toasts]);

  return (
    <Toaster
      position="top-center"
      gutter={8}
      containerStyle={{
        top: 'max(0.75rem, env(safe-area-inset-top))',
        zIndex: 9999
      }}
      toastOptions={{
        duration: 2000,
        style: {
          background: 'rgba(19, 28, 46, 0.96)',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '16px',
          padding: '8px 12px',
          fontSize: '13px',
          fontWeight: 500,
          boxShadow: '0 14px 34px rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(16px)',
          maxWidth: '92vw'
        }
      }}
    >
      {(t) => <SwipeableToastItem t={t} />}
    </Toaster>
  );
}

function SwipeableToastItem({ t }: { t: any }) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [swiping, setSwiping] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    setSwiping(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    setOffset({ x: dx, y: Math.min(20, dy) });

    // Dismiss immediately once swiped past threshold (left, right, or up)
    if (Math.abs(dx) > 60 || dy < -30) {
      startRef.current = null;
      setSwiping(false);
      toast.dismiss(t.id);
    }
  };

  const handlePointerUp = () => {
    if (!startRef.current) return;
    if (Math.abs(offset.x) > 50 || offset.y < -25) {
      toast.dismiss(t.id);
    } else {
      setOffset({ x: 0, y: 0 });
    }
    startRef.current = null;
    setSwiping(false);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        transition: swiping ? 'none' : 'transform 0.16s ease-out, opacity 0.16s ease-out',
        opacity: Math.max(0.15, 1 - Math.abs(offset.x) / 130 - Math.max(0, -offset.y) / 70),
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
      className="cursor-grab active:cursor-grabbing flex items-center"
    >
      {t.type === 'custom' ? (
        typeof t.message === 'function' ? t.message(t) : t.message
      ) : (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <div
              onClick={() => toast.dismiss(t.id)}
              className="flex items-center gap-2 pr-1 cursor-pointer"
              title="Swipe or tap to dismiss"
            >
              {icon}
              <div className="text-xs sm:text-sm font-medium leading-snug">{message}</div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.dismiss(t.id);
                }}
                className="ml-1 p-1 rounded-full hover:bg-white/15 text-white/60 hover:text-white transition-colors flex-shrink-0"
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </ToastBar>
      )}
    </div>
  );
}

interface UseGlobalNotificationsProps {
  activeChatUid: string | null;
  onSelectChat: (chatUser: any) => void;
}

export function useGlobalNotifications({ activeChatUid, onSelectChat }: UseGlobalNotificationsProps) {
  const { user } = useAuthStore();
  const activeChatUidRef = useRef(activeChatUid);
  activeChatUidRef.current = activeChatUid;

  // Store callback in a ref so parent re-renders never re-subscribe Firestore listener
  const onSelectChatRef = useRef(onSelectChat);
  onSelectChatRef.current = onSelectChat;

  // Track already-notified message timestamps per document ID to prevent duplicate popups
  const notifiedMapRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    let isInitialLoad = true;
    const inboxCol = collection(db, 'users', user.uid, 'inbox');
    const q = query(inboxCol);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitialLoad) {
        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (data?.timestamp) {
            notifiedMapRef.current.set(d.id, data.timestamp);
          }
        });
        isInitialLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const docId = change.doc.id;
          const data = change.doc.data();
          const senderId = data.senderId;

          if (!senderId || senderId === user.uid) return;

          const now = Date.now();
          const msgTime = data.timestamp || 0;
          if (now - msgTime > 25000) return;

          // Deduplicate: skip if we already showed a notification for this exact timestamp
          const prevNotifiedTime = notifiedMapRef.current.get(docId);
          if (prevNotifiedTime && prevNotifiedTime >= msgTime) return;
          notifiedMapRef.current.set(docId, msgTime);

          const isCurrentChat = activeChatUidRef.current === senderId;
          const isBackgrounded = document.hidden;

          if (!isCurrentChat || isBackgrounded) {
            playNotificationSound();
            showSystemNotification(
              data.senderName || 'ChatWave Message',
              data.text || (data.imageUrl ? '📷 Sent a photo' : '🎙️ Sent a voice note'),
              data.senderPhotoURL || '/favicon.svg',
              () => {
                onSelectChatRef.current({
                  uid: senderId,
                  name: data.senderName,
                  username: data.senderUsername,
                  photoURL: data.senderPhotoURL
                });
              }
            );

            if (!isBackgrounded) {
              toast.dismiss(); // Clear any previous banner so two never stack up
              toast.custom((t) => (
                <div 
                  onClick={() => {
                    toast.dismiss(t.id);
                    onSelectChatRef.current({
                      uid: senderId,
                      name: data.senderName,
                      username: data.senderUsername,
                      photoURL: data.senderPhotoURL
                    });
                  }}
                  className={`max-w-sm w-[92vw] bg-surface/95 border border-primary/40 shadow-2xl rounded-2xl p-2.5 px-3 flex items-center gap-3 cursor-pointer hover:border-primary transition-all backdrop-blur-2xl ${
                    t.visible ? 'animate-in fade-in slide-in-from-top-3 duration-150' : 'animate-out fade-out duration-150'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex-shrink-0 overflow-hidden border border-white/15 flex items-center justify-center">
                    {data.senderPhotoURL ? (
                      <img src={data.senderPhotoURL} alt={data.senderName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary font-bold text-xs">{(data.senderName || 'U').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-text truncate flex items-center gap-1.5">
                      <span>{data.senderName || 'New Message'}</span>
                      <span className="text-[10px] text-text-secondary font-normal">now</span>
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {data.text || (data.imageUrl ? '📷 Sent a photo' : '🎙️ Sent a voice note')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.dismiss(t.id);
                    }}
                    className="p-1.5 rounded-full hover:bg-white/15 text-text-secondary hover:text-white transition-colors flex-shrink-0"
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              ), { id: 'global-msg-banner', duration: 2200 });
            }
          }
        }
      });
    }, (err) => {
      console.warn("Global notification listener error:", err);
    });

    return () => unsubscribe();
  }, [user?.uid]);
}
