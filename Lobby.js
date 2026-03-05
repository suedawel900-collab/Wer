import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Lobby({ onJoinRoom, onCreateRoom }) {
  const { user, token, logout, refreshUser, API } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [buyIn, setBuyIn] = useState(10);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [leaderboard, setLeaderboard] = useState([]);
  const [addAmount, setAddAmount] = useState(50);
  const [tab, setTab] = useState('lobby');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadRooms(); loadLeaderboard();
    const i = setInterval(loadRooms, 5000);
    return () => clearInterval(i);
  }, []);

  const loadRooms = async () => {
    const r = await fetch(`${API}/api/rooms`);
    setRooms(await r.json());
  };

  const loadLeaderboard = async () => {
    const r = await fetch(`${API}/api/leaderboard`);
    setLeaderboard(await r.json());
  };

  const createRoom = async () => {
    const r = await fetch(`${API}/api/rooms`, {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify({ buyIn, maxPlayers })
    });
    const data = await r.json();
    if (data.error) return setMsg(data.error);
    onCreateRoom(data.code);
  };

  const addCredits = async () => {
    const r = await fetch(`${API}/api/payment/add-credits`, {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify({ amount: addAmount })
    });
    const data = await r.json();
    if (data.success) { refreshUser(); setMsg(`✅ Added $${addAmount} credits!`); }
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>🎱 BINGO</div>
        <div style={s.userBar}>
          <div style={s.balance}>💰 ${user?.balance || 0}</div>
          <div style={s.username}>👤 {user?.username}</div>
          <button style={s.logoutBtn} onClick={logout}>Sign Out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {['lobby','create','wallet','leaderboard'].map(t=>(
          <button key={t} style={{...s.tab,...(tab===t?s.activeTab:{})}} onClick={()=>setTab(t)}>
            {t==='lobby'?'🎮 Lobby':t==='create'?'➕ Create':t==='wallet'?'💳 Wallet':'🏆 Leaders'}
          </button>
        ))}
      </div>

      {msg && <div style={s.msg}>{msg}</div>}

      {/* Lobby tab */}
      {tab==='lobby' && (
        <div style={s.content}>
          <div style={s.section}>
            <div style={s.sectionTitle}>Join with Code</div>
            <div style={s.row}>
              <input style={s.input} placeholder="Room code (e.g. AB12CD)"
                value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={6}/>
              <button style={s.btnPrimary} onClick={()=>joinCode && onJoinRoom(joinCode)}>Join</button>
            </div>
          </div>
          <div style={s.section}>
            <div style={s.sectionTitle}>Open Rooms ({rooms.length})</div>
            {rooms.length === 0 && <div style={s.empty}>No open rooms. Create one!</div>}
            {rooms.map(room=>(
              <div key={room.code} style={s.roomCard}>
                <div>
                  <div style={s.roomCode}>{room.code}</div>
                  <div style={s.roomHost}>Host: {room.host}</div>
                </div>
                <div style={s.roomMeta}>
                  <span style={s.badge}>💰 ${room.buyIn}</span>
                  <span style={s.badge}>👥 {room.playerCount}/{room.maxPlayers}</span>
                </div>
                <button style={s.btnSmall} onClick={()=>onJoinRoom(room.code)}>Join</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create tab */}
      {tab==='create' && (
        <div style={s.content}>
          <div style={s.section}>
            <div style={s.sectionTitle}>Create a Room</div>
            <label style={s.label}>Buy-in Amount ($)</label>
            <input style={s.input} type="number" min="1" max="1000" value={buyIn}
              onChange={e=>setBuyIn(+e.target.value)} />
            <label style={s.label}>Max Players</label>
            <input style={s.input} type="number" min="2" max="20" value={maxPlayers}
              onChange={e=>setMaxPlayers(+e.target.value)} />
            <div style={s.prizePreview}>🏆 Prize Pool: ${buyIn * maxPlayers} (if full)</div>
            <button style={s.btnPrimary} onClick={createRoom}>Create Room</button>
          </div>
        </div>
      )}

      {/* Wallet tab */}
      {tab==='wallet' && (
        <div style={s.content}>
          <div style={s.section}>
            <div style={s.sectionTitle}>Your Wallet</div>
            <div style={s.balanceBig}>💰 ${user?.balance}</div>
            <div style={s.statsRow}>
              <div style={s.stat}><div style={s.statNum}>{user?.gamesPlayed||0}</div><div style={s.statLabel}>Played</div></div>
              <div style={s.stat}><div style={s.statNum}>{user?.gamesWon||0}</div><div style={s.statLabel}>Won</div></div>
              <div style={s.stat}><div style={s.statNum}>{user?.gamesPlayed?Math.round((user.gamesWon/user.gamesPlayed)*100):0}%</div><div style={s.statLabel}>Win Rate</div></div>
            </div>
            <div style={s.sectionTitle}>Add Credits (Demo)</div>
            <div style={s.chipRow}>
              {[10,25,50,100].map(a=>(
                <button key={a} style={{...s.chipBtn,...(addAmount===a?s.chipActive:{})}} onClick={()=>setAddAmount(a)}>${a}</button>
              ))}
            </div>
            <button style={s.btnPrimary} onClick={addCredits}>Add ${addAmount} Credits</button>
            <p style={s.hint}>💡 In production, this connects to Stripe for real payments</p>
          </div>
        </div>
      )}

      {/* Leaderboard tab */}
      {tab==='leaderboard' && (
        <div style={s.content}>
          <div style={s.section}>
            <div style={s.sectionTitle}>🏆 Top Players</div>
            {leaderboard.map((p,i)=>(
              <div key={i} style={s.lbRow}>
                <div style={s.lbRank}>{['🥇','🥈','🥉'][i]||`#${i+1}`}</div>
                <div style={s.lbName}>{p.username}</div>
                <div style={s.lbStat}>{p.gamesWon}W / {p.gamesPlayed}G</div>
              </div>
            ))}
            {leaderboard.length===0 && <div style={s.empty}>No games played yet!</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { minHeight:'100vh',background:'#0f0a1e',color:'#fff',fontFamily:"'Nunito',sans-serif",backgroundImage:'radial-gradient(ellipse at 20% 20%,rgba(255,107,107,0.07) 0%,transparent 50%),radial-gradient(ellipse at 80% 80%,rgba(77,150,255,0.07) 0%,transparent 50%)' },
  header: { display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid rgba(255,255,255,0.06)' },
  logo: { fontFamily:"'Boogaloo',cursive",fontSize:'2rem',background:'linear-gradient(135deg,#ff6b6b,#ffd93d,#6bcb77)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' },
  userBar: { display:'flex',alignItems:'center',gap:12 },
  balance: { background:'rgba(255,217,61,0.15)',color:'#ffd93d',padding:'6px 14px',borderRadius:20,fontWeight:700,fontSize:'0.95rem' },
  username: { color:'rgba(255,255,255,0.7)',fontSize:'0.9rem' },
  logoutBtn: { padding:'6px 14px',borderRadius:20,border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:'0.85rem',fontFamily:"'Nunito',sans-serif" },
  tabs: { display:'flex',gap:0,padding:'0 24px',borderBottom:'1px solid rgba(255,255,255,0.06)' },
  tab: { padding:'14px 20px',border:'none',background:'transparent',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontFamily:"'Nunito',sans-serif",fontSize:'0.9rem',fontWeight:700,borderBottom:'2px solid transparent',transition:'all 0.2s' },
  activeTab: { color:'#4d96ff',borderBottomColor:'#4d96ff' },
  msg: { margin:'12px 24px',padding:'10px 16px',borderRadius:10,background:'rgba(77,150,255,0.15)',color:'#4d96ff',fontSize:'0.9rem' },
  content: { padding:'24px',maxWidth:680,margin:'0 auto' },
  section: { background:'#1a1035',borderRadius:16,padding:'24px',marginBottom:20,border:'1px solid rgba(255,255,255,0.07)',display:'flex',flexDirection:'column',gap:12 },
  sectionTitle: { fontFamily:"'Boogaloo',cursive",fontSize:'1.3rem',color:'rgba(255,255,255,0.6)',letterSpacing:'0.05em',marginBottom:4 },
  row: { display:'flex',gap:10 },
  input: { flex:1,padding:'12px 16px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:'1rem',fontFamily:"'Nunito',sans-serif",outline:'none' },
  label: { fontSize:'0.85rem',color:'rgba(255,255,255,0.5)',marginBottom:-6 },
  btnPrimary: { padding:'13px 24px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#4d96ff,#7c3aed)',color:'#fff',fontSize:'1rem',fontFamily:"'Boogaloo',cursive",letterSpacing:'0.05em',cursor:'pointer',width:'100%' },
  btnSmall: { padding:'8px 18px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#4d96ff,#7c3aed)',color:'#fff',fontSize:'0.9rem',fontFamily:"'Nunito',sans-serif",fontWeight:700,cursor:'pointer',whiteSpace:'nowrap' },
  empty: { color:'rgba(255,255,255,0.3)',textAlign:'center',padding:'20px 0',fontSize:'0.95rem' },
  roomCard: { display:'flex',alignItems:'center',gap:12,padding:'14px',borderRadius:12,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)' },
  roomCode: { fontFamily:"'Boogaloo',cursive",fontSize:'1.3rem',color:'#ffd93d',letterSpacing:'0.1em' },
  roomHost: { fontSize:'0.8rem',color:'rgba(255,255,255,0.4)' },
  roomMeta: { display:'flex',gap:8,marginLeft:'auto',marginRight:8 },
  badge: { fontSize:'0.8rem',background:'rgba(255,255,255,0.08)',padding:'4px 10px',borderRadius:20,color:'rgba(255,255,255,0.6)' },
  prizePreview: { background:'rgba(107,203,119,0.1)',color:'#6bcb77',padding:'12px 16px',borderRadius:10,textAlign:'center',fontWeight:700 },
  balanceBig: { fontSize:'3rem',fontFamily:"'Boogaloo',cursive",color:'#ffd93d',textAlign:'center',padding:'16px 0' },
  statsRow: { display:'flex',gap:12,justifyContent:'center' },
  stat: { textAlign:'center',background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'16px 24px' },
  statNum: { fontSize:'2rem',fontFamily:"'Boogaloo',cursive",color:'#4d96ff' },
  statLabel: { fontSize:'0.8rem',color:'rgba(255,255,255,0.4)' },
  chipRow: { display:'flex',gap:8 },
  chipBtn: { flex:1,padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:'1rem' },
  chipActive: { background:'rgba(77,150,255,0.2)',color:'#4d96ff',borderColor:'#4d96ff' },
  hint: { color:'rgba(255,255,255,0.3)',fontSize:'0.8rem',textAlign:'center' },
  lbRow: { display:'flex',alignItems:'center',gap:14,padding:'12px',borderRadius:10,background:'rgba(255,255,255,0.04)' },
  lbRank: { fontSize:'1.5rem',width:36,textAlign:'center' },
  lbName: { flex:1,fontWeight:700,fontSize:'1rem' },
  lbStat: { color:'rgba(255,255,255,0.4)',fontSize:'0.85rem' },
};
