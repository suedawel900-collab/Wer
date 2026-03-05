import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Auth({ onSuccess }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username:'', email:'', password:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handle = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.username, form.email, form.password);
      onSuccess && onSuccess();
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.title}>🎱 BINGO</div>
        <div style={styles.tabs}>
          {['login','register'].map(m=>(
            <button key={m} onClick={()=>setMode(m)}
              style={{...styles.tab, ...(mode===m?styles.activeTab:{})}}>
              {m==='login'?'Sign In':'Sign Up'}
            </button>
          ))}
        </div>
        <form onSubmit={handle} style={styles.form}>
          {mode==='register' && (
            <input style={styles.input} placeholder="Username" value={form.username}
              onChange={e=>setForm({...form,username:e.target.value})} required />
          )}
          <input style={styles.input} type="email" placeholder="Email" value={form.email}
            onChange={e=>setForm({...form,email:e.target.value})} required />
          <input style={styles.input} type="password" placeholder="Password" value={form.password}
            onChange={e=>setForm({...form,password:e.target.value})} required />
          {error && <div style={styles.error}>{error}</div>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? '...' : mode==='login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        {mode==='login' && <p style={styles.hint}>Demo: use any email + password to register first</p>}
      </div>
    </div>
  );
}

const styles = {
  overlay: { position:'fixed',inset:0,background:'#0f0a1e',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 },
  card: { background:'#1a1035',borderRadius:20,padding:'40px 36px',width:'100%',maxWidth:400,border:'1px solid rgba(255,255,255,0.1)' },
  title: { fontFamily:"'Boogaloo',cursive",fontSize:'3.5rem',textAlign:'center',background:'linear-gradient(135deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#ff6bff)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:24 },
  tabs: { display:'flex',gap:8,marginBottom:24 },
  tab: { flex:1,padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontFamily:"'Nunito',sans-serif",fontSize:'1rem',fontWeight:700 },
  activeTab: { background:'rgba(77,150,255,0.2)',color:'#4d96ff',borderColor:'#4d96ff' },
  form: { display:'flex',flexDirection:'column',gap:12 },
  input: { padding:'13px 16px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:'1rem',fontFamily:"'Nunito',sans-serif",outline:'none' },
  error: { color:'#ff6b6b',fontSize:'0.9rem',textAlign:'center' },
  btn: { padding:'14px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#4d96ff,#7c3aed)',color:'#fff',fontSize:'1.1rem',fontFamily:"'Boogaloo',cursive",letterSpacing:'0.06em',cursor:'pointer',marginTop:4 },
  hint: { color:'rgba(255,255,255,0.3)',fontSize:'0.78rem',textAlign:'center',marginTop:16 }
};
