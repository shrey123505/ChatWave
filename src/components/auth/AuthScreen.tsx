import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Mail, Lock, User, AtSign, Calendar } from 'lucide-react';

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
      const authEmail = email.includes('@') ? email : \`\${email}@chatwave.app\`;
      
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
