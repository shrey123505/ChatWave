import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { useAuthStore } from './store/useAuthStore';
import AuthScreen from './components/auth/AuthScreen';
import ChatLayout from './components/chat/ChatLayout';

function App() {
  const { user, loading, setUser } = useAuthStore();

  useEffect(() => {
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

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Just to be safe, also check/create profile on normal auth state changes
        // if they somehow bypassed the redirect result hook (e.g. email/password first login)
        await ensureUserProfile(u);
      }
      setUser(u);
    });
    return () => unsubscribe();
  }, [setUser]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <AuthScreen /> : <Navigate to="/" />} />
        <Route path="/" element={user ? <ChatLayout /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
