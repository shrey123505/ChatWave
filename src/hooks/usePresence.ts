import { useEffect, useRef } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';

export function usePresence() {
  const { user } = useAuthStore();
  const heartbeatIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const userDocRef = doc(db, 'users', user.uid);

    // Set user as Online
    const setOnline = async () => {
      try {
        await updateDoc(userDocRef, {
          isOnline: true,
          lastSeen: serverTimestamp()
        });
      } catch (e) {
        console.warn("Presence setOnline error:", e);
      }
    };

    // Set user as Offline
    const setOffline = async () => {
      try {
        await updateDoc(userDocRef, {
          isOnline: false,
          lastSeen: serverTimestamp()
        });
      } catch (e) {
        console.warn("Presence setOffline error:", e);
      }
    };

    // 1. Mark online on initial load
    setOnline();

    // 2. Heartbeat every 60s while the window is focused / document is visible
    heartbeatIntervalRef.current = setInterval(() => {
      if (!document.hidden) {
        setOnline();
      }
    }, 60000);

    // 3. Handle visibility change (tab minimized or switched)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setOffline();
      } else {
        setOnline();
      }
    };

    // 4. Handle window beforeunload / closing
    const handleBeforeUnload = () => {
      setOffline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOffline();
    };
  }, [user?.uid]);
}

// Utility to format clean presence string
export function formatPresence(isOnline?: boolean, lastSeen?: any, hideLastSeen?: boolean): string {
  if (hideLastSeen) return '';
  if (isOnline) return '● Online';

  if (!lastSeen) return '';

  const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffMinutes < 2) return '● Online';
  if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = now.toDateString() === date.toDateString();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();

  if (isToday) return `Last seen today at ${timeStr}`;
  if (isYesterday) return `Last seen yesterday at ${timeStr}`;

  return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}
