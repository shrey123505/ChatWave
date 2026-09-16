import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithRedirect, signInWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../../lib/firebase';
import { Lock, User, AtSign } from 'lucide-react';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const authEmail = email.includes('@') ? email : `${email}@chatwave.app`;
      
      if (isLogin) {
        await signInWithEmailAndPassword(auth, authEmail, password);
      } else {
        const res = await createUserWithEmailAndPassword(auth, authEmail, password);
        await updateProfile(res.user, { displayName: name });
        await setDoc(doc(db, 'users', res.user.uid), {
          uid: res.user.uid,
          name: name.trim() || email,
          username: email.trim().toLowerCase(),
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
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid username or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This username is already taken. Please choose another.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      // First attempt popup sign-in (instant, doesn't leave page or trigger page reloads)
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.warn("Popup sign-in encountered an issue, trying redirect fallback:", err);
      // If popup was blocked or not supported (e.g. strict standalone PWA), fallback to redirect
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          setError(redirectErr.message);
        }
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 z-0"></div>
      
      <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-2xl relative z-10 border border-white/10 shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            ChatWave
          </h1>
          <p className="text-text-secondary mt-1.5 text-xs sm:text-sm">
            Fast, private & real-time conversations.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              isLogin 
                ? 'bg-primary text-white shadow-md' 
                : 'text-text-secondary hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              !isLogin 
                ? 'bg-primary text-white shadow-md' 
                : 'text-text-secondary hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Google Sign-in Option (Kept 100% Intact & Prominent) */}
        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-2.5 px-4 bg-surface border border-white/15 text-text font-semibold rounded-xl hover:bg-white/5 transition-all active:scale-98 disabled:opacity-50 flex justify-center items-center gap-2.5 text-xs sm:text-sm shadow-md"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="my-5 flex items-center justify-center space-x-3">
          <div className="h-px bg-white/10 flex-1"></div>
          <span className="text-text-secondary text-[11px] uppercase tracking-wider font-semibold">Or with username</span>
          <div className="h-px bg-white/10 flex-1"></div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-4 text-xs">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!isLogin && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                <User size={16} />
              </div>
              <input 
                type="text" 
                placeholder="Full Name (e.g. Shrey Sharma)" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                className="w-full pl-9 pr-4 py-2.5 bg-surface border border-white/10 rounded-xl focus:outline-none focus:border-primary text-text placeholder-text-secondary text-xs transition-colors" 
              />
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
              <AtSign size={16} />
            </div>
            <input 
              type="text" 
              placeholder={isLogin ? "Username or email" : "Choose username (e.g. shrey_11)"} 
              value={email} 
              onChange={(e) => setEmail(e.target.value.replace(/\s+/g, '').toLowerCase())} 
              required 
              className="w-full pl-9 pr-4 py-2.5 bg-surface border border-white/10 rounded-xl focus:outline-none focus:border-primary text-text placeholder-text-secondary text-xs transition-colors" 
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
              <Lock size={16} />
            </div>
            <input 
              type="password" 
              placeholder="Password (min 6 characters)" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              minLength={6} 
              className="w-full pl-9 pr-4 py-2.5 bg-surface border border-white/10 rounded-xl focus:outline-none focus:border-primary text-text placeholder-text-secondary text-xs transition-colors" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-2.5 mt-2 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl hover:opacity-90 active:scale-98 transition-all disabled:opacity-50 flex justify-center items-center text-xs sm:text-sm shadow-lg"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            ) : (
              isLogin ? 'Log In' : 'Create Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
