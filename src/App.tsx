import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, getRedirectResult, signOut } from 'firebase/auth';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { useAuthStore } from './store/useAuthStore';
import AuthScreen from './components/auth/AuthScreen';
import ChatLayout from './components/chat/ChatLayout';
import { ShieldAlert, LogOut } from 'lucide-react';

function App() {
  const { user, userProfile, loading, setUser, setUserProfile } = useAuthStore();
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const ensureUserProfile = async (firebaseUser: FirebaseAuthUser) => {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        let baseUsername = (firebaseUser.email || firebaseUser.displayName || 'user')
          .split('@')[0]
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase();
          
        let candidate = baseUsername;
        let isUnique = false;
        
        for (let i = 0; i < 10; i++) {
          const q = query(collection(db, 'users'), where('username', '==', candidate));
          const snapshot = await getDocs(q);
          if (snapshot.empty) {
            isUnique = true;
            break;
          }
          candidate = `${baseUsername}_${Math.floor(Math.random() * 1000)}`;
        }

        if (!isUnique) {
          candidate = `${baseUsername}_${Date.now()}`;
        }

        await setDoc(userRef, {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Anonymous',
          username: candidate,
          photoURL: '',
          bio: "Hey there! I'm using ChatWave.",
          isPrivate: false,
          hideLastSeen: false,
          isOnline: true,
          lastSeen: new Date().toISOString(),
          followersCount: 0,
          followingCount: 0,
          createdAt: new Date().toISOString()
        });
      }
    };

    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await ensureUserProfile(result.user);
        }
      } catch (error) {
        console.error("Error from redirect result:", error);
      }
    };

    handleRedirectResult();

    const authUnsub = onAuthStateChanged(auth, async (u) => {
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (u) {
        await ensureUserProfile(u);
        // Subscribe to live profile document
        profileUnsub = onSnapshot(doc(db, 'users', u.uid), (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data());
          }
          setProfileLoading(false);
        }, (err) => {
          console.error("Profile subscription error:", err);
          setProfileLoading(false);
        });
      } else {
        setUserProfile(null);
        setProfileLoading(false);
      }
      setUser(u);
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, [setUser, setUserProfile]);

  if (loading || (user && profileLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Account Suspension / Ban Screen Guard
  if (user && userProfile?.isBanned) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background text-text">
        <div className="glass-panel max-w-md w-full p-8 rounded-2xl border border-red-500/30 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-2xl font-bold text-red-400">Account Suspended</h2>
          <p className="text-text-secondary text-sm">
            Your ChatWave account has been suspended by the platform administrator for violating community guidelines.
          </p>
          <button
            onClick={() => signOut(auth)}
            className="w-full py-3 px-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold text-sm border border-red-500/40 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <ChatLayout /> : <AuthScreen />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
