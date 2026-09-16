import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithRedirect, signInWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../../lib/firebase';
import { Lock, User, AtSign, Calendar } from 'lucide-react';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
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
          name,
          age,
          username: email,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message);
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
      
      <div className="glass-panel w-full max-w-md p-8 rounded-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            ChatWave
          </h1>
          <p className="text-text-secondary mt-2">
            {isLogin ? 'Welcome back! Log in to continue.' : 'Create a new account to get started.'}
          </p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                  <User size={18} />
                </div>
                <input type="text" placeholder="Full Name or Username" value={name} onChange={(e) => setName(e.target.value)} required className="w-full pl-10 pr-4 py-3 bg-surface border border-white/10 rounded-xl focus:outline-none focus:border-primary text-text placeholder-text-secondary transition-colors" />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                  <Calendar size={18} />
                </div>
                <input type="number" placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} required min="13" className="w-full pl-10 pr-4 py-3 bg-surface border border-white/10 rounded-xl focus:outline-none focus:border-primary text-text placeholder-text-secondary transition-colors" />
              </div>
            </>
          )}

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
              <AtSign size={18} />
            </div>
            <input type="text" placeholder="Username (e.g. shrey_11)" value={email} onChange={(e) => setEmail(e.target.value.replace(/\\s+/g, '').toLowerCase())} required className="w-full pl-10 pr-4 py-3 bg-surface border border-white/10 rounded-xl focus:outline-none focus:border-primary text-text placeholder-text-secondary transition-colors" />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
              <Lock size={18} />
            </div>
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full pl-10 pr-4 py-3 bg-surface border border-white/10 rounded-xl focus:outline-none focus:border-primary text-text placeholder-text-secondary transition-colors" />
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 mt-4 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center">
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center space-x-4">
          <div className="h-px bg-white/10 flex-1"></div>
          <span className="text-text-secondary text-sm">OR</span>
          <div className="h-px bg-white/10 flex-1"></div>
        </div>

        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 mt-6 bg-surface border border-white/10 text-text font-semibold rounded-xl hover:bg-white/5 transition-colors disabled:opacity-50 flex justify-center items-center space-x-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="mt-6 text-center text-text-secondary">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline focus:outline-none font-medium">
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}
