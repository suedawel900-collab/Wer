import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const LETTERS = ['B','I','N','G','O'];
const COLORS = { B:'#ff6b6b', I:'#ffd93d', N:'#6bcb77', G:'#4d96ff', O:'#ff6bff' };
const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export default function Game({ roomCode, onLeave }) {
  const { user, token, refreshUser } = useAuth();
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState(null);
  const [card, setCard] = useState(null);
  const [marked, setMarked] = useState(null);
  const [calledNumbers, setCalledNumbers] = useState([]);
  const [lastCall, setLastCall] = useState(null);
  const [status, setStatus] = useState('Connecting...');
  const [gamePhase, setGamePhase] = useState('waiting'); // waiting|playing|finished
  const [winner, setWinner] = useState(null);
  const [error, setError] = useState('');
  const [paidIn, setPaidIn] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const canvasRef = useRef();

  const isHost = room?.hostId === user?.id;

  useEffect(() => {
    const sock = io(API, { auth: { token } });
    setSocket(sock);

    sock.on('connect', () => { setStatus('Connected'); sock.emit('joinRoom', { roomCode }); });
    sock.on('connect_error', (e) => setError('Connection failed: ' + e.message));
    sock.on('error', (msg) => setError(msg));

    sock.on('roomUpdate', (r) => { setRoom(r); });

    sock.on('cardDealt', ({ card: c }) => {
      setCard(c);
      const m = Array.from({length:5},()=>Array(5).fill(false));
      m[2][2] = true;
      setMarked(m);
    });

    sock.on('gameStarted', ({ room: r }) => {
      setRoom(r); setGamePhase('playing');
      setCalledNumbers([]); setLastCall(null); setWinner(null);
      setStatus('Game started! Host is calling numbers...');
    });

    sock.on('numberCalled', ({ number, letter, calledNumbers: called }) => {
      setCalledNumbers(called);
      setLastCall({ number, letter });
      setStatus(`Called: ${letter}-${number}`);
      // Auto-mark matching cells
      setMarked(prev => {
        if (!prev || !card) return prev;
        const next = prev.map(col => [...col]);
        for (let c=0;c<5;c++) for (let r=0;r<5;r++)
          if (card[c][r] === number) next[c][r] = true;
        return next;
      });
    });

    sock.on('gameOver', ({ winnerId, winnerName, prize }) => {
      setGamePhase('finished');
      setWinner({ id: winnerId, name: winnerName, prize });
      setStatus('Game over!');
      if (winnerId === user?.id) { setConfetti(true); refreshUser(); }
    });

    sock.on('falseBingo', ({ message }) => setError(message));

    return () => sock.disconnect();
  }, [roomCode, token]);

  useEffect(() => {
    if (confetti) launchConfetti();
  }, [confetti]);

  const payIn = async () => {
    const r = await fetch(`${API}/api/payment/demo-buyin`, {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify({ roomCode })
    });
    const data = await r.json();
    if (data.error) return setError(data.error);
    setPaidIn(true); setRoom(prev=>({...prev, prizePool: data.prizePool}));
    refreshUser();
  };

  const markCell = (col, row) => {
    if (gamePhase !== 'playing' || !marked || !card) return;
    const num = card[col][row];
    if (num === 0) return; // FREE
    if (!calledNumbers.includes(num)) { setError("That number hasn't been called!"); setTimeout(()=>setError(''),2000); return; }
    const next = marked.map(c=>[...c]);
    next[col][row] = !next[col][row];
    setMarked(next);
  };

  const claimBingo = () => { socket?.emit('claimBingo', { roomCode }); };
  const callNumber = () => { socket?.emit('callNumber', { roomCode }); };
  const startGame = () => { socket?.emit('startGame', { roomCode }); };
  const readyUp = () => { socket?.emit('playerReady', { roomCode }); };

  const launchConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const pieces = Array.from({length:200},()=>({
      x:Math.random()*canvas.width, y:-20-Math.random()*100,
      w:6+Math.random()*10, h:4+Math.random()*6,
      color:['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff6bff','#fff'][Math.floor(Math.random()*6)],
      vx:(Math.random()-0.5)*4, vy:2+Math.random()*4,
      angle:Math.random()*Math.PI*2, va:(Math.random()-0.5)*0.2
    }));
    let frame;
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      let alive = false;
      pieces.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy; p.angle+=p.va; p.vy+=0.06;
        if(p.y<canvas.height+20) alive=true;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle);
        ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        ctx.restore();
      });
      if(alive) frame=requestAnimationFrame(draw); else ctx.clearRect(0,0,canvas.width,canvas.height);
    };
    cancelAnimationFrame(frame); draw();
    setTimeout(()=>setConfetti(false), 6000);
  };

  return (
    <div style={g.page}>
      <canvas ref={canvasRef} style={g.canvas}/>

      {/* Header */}
      <div style={g.header}>
        <button style={g.backBtn} onClick={onLeave}>← Leave</button>
        <div style={g.roomBadge}>Room: <span style={{color:'#ffd93d'}}>{roomCode}</span></div>
        <div style={g.prizePool}>🏆 Prize: ${room?.prizePool||0}</div>
      </div>

      {error && <div style={g.errorBar}>{error}</div>}

      <div style={g.layout}>
        {/* Card */}
        <div style={g.cardSection}>
          <div style={g.statusBar}>{status}</div>

          {/* BINGO header letters */}
          <div style={g.bingoHeader}>
            {LETTERS.map(l=>(
              <div key={l} style={{...g.colLetter, color:COLORS[l], textShadow:`0 0 16px ${COLORS[l]}`}}>{l}</div>
            ))}
          </div>

          {/* Card grid */}
          {card ? (
            <div style={g.grid}>
              {Array.from({length:5},(_,row)=>
                Array.from({length:5},(_,col)=>{
                  const num = card[col][row];
                  const isMarked = marked?.[col]?.[row];
                  const isFree = num===0;
                  const isCalled = calledNumbers.includes(num);
                  return (
                    <div key={`${col}-${row}`}
                      onClick={()=>!isFree && markCell(col,row)}
                      style={{
                        ...g.cell,
                        ...(isFree?g.freeCell:{}),
                        ...(isMarked&&!isFree?g.markedCell:{}),
                        ...(isCalled&&!isMarked&&!isFree?g.calledCell:{})
                      }}>
                      {isFree?'FREE':num}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div style={g.waiting}>Waiting for card...</div>
          )}

          {/* Action buttons */}
          <div style={g.actions}>
            {gamePhase==='waiting' && !paidIn && room?.buyIn > 0 && (
              <button style={g.btnPay} onClick={payIn}>💰 Pay ${room?.buyIn} Buy-in</button>
            )}
            {gamePhase==='waiting' && (paidIn || room?.buyIn===0) && (
              <button style={g.btnReady} onClick={readyUp}>✅ Ready Up</button>
            )}
            {gamePhase==='playing' && isHost && (
              <button style={g.btnCall} onClick={callNumber}
                disabled={calledNumbers.length>=75}>
                🎲 Call Number ({75-calledNumbers.length} left)
              </button>
            )}
            {gamePhase==='playing' && (
              <button style={g.btnBingo} onClick={claimBingo}>🎉 BINGO!</button>
            )}
            {isHost && gamePhase==='waiting' && (
              <button style={g.btnStart} onClick={startGame}>▶ Start Game</button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={g.sidebar}>
          {/* Current call */}
          <div style={g.panel}>
            <div style={g.panelTitle}>Current Call</div>
            {lastCall ? (
              <div style={g.callDisplay}>
                <span style={{fontSize:'1.8rem',color:COLORS[lastCall.letter]}}>{lastCall.letter}</span>
                <span style={{fontSize:'4rem',fontFamily:"'Boogaloo',cursive",color:COLORS[lastCall.letter],lineHeight:1}}>{lastCall.number}</span>
              </div>
            ) : (
              <div style={g.callDisplay}><span style={{color:'rgba(255,255,255,0.3)',fontSize:'2rem'}}>—</span></div>
            )}
          </div>

          {/* Players */}
          <div style={g.panel}>
            <div style={g.panelTitle}>Players ({room?.players?.length||0}/{room?.maxPlayers||0})</div>
            {room?.players?.map(p=>(
              <div key={p.id} style={g.playerRow}>
                <span>{p.id===room.hostId?'👑':''} {p.username}</span>
                <span style={{...g.playerStatus,...(p.ready?g.playerReady:{})}}>{p.ready?'Ready':'Waiting'}</span>
              </div>
            ))}
          </div>

          {/* Called numbers */}
          <div style={g.panel}>
            <div style={g.panelTitle}>Called ({calledNumbers.length}/75)</div>
            <div style={g.calledGrid}>
              {calledNumbers.map((n,i)=>{
                const l = n<=15?'B':n<=30?'I':n<=45?'N':n<=60?'G':'O';
                return <span key={i} style={{...g.chip, background:i===calledNumbers.length-1?`${COLORS[l]}33`:undefined, color:i===calledNumbers.length-1?COLORS[l]:'rgba(255,255,255,0.5)'}}>{l}{n}</span>;
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Win overlay */}
      {winner && (
        <div style={g.overlay}>
          <div style={g.winCard}>
            <div style={g.winTitle}>{winner.id===user?.id?'🎊 YOU WIN!':'😔 You Lost'}</div>
            <div style={g.winSub}>{winner.name} wins ${winner.prize}!</div>
            <button style={g.btnLeave} onClick={onLeave}>Back to Lobby</button>
          </div>
        </div>
      )}
    </div>
  );
}

const g = {
  page: { minHeight:'100vh',background:'#0f0a1e',color:'#fff',fontFamily:"'Nunito',sans-serif",backgroundImage:'radial-gradient(ellipse at 20% 20%,rgba(255,107,107,0.07) 0%,transparent 50%),radial-gradient(ellipse at 80% 80%,rgba(77,150,255,0.07) 0%,transparent 50%)' },
  canvas: { position:'fixed',inset:0,pointerEvents:'none',zIndex:1000,width:'100%',height:'100%' },
  header: { display:'flex',alignItems:'center',gap:16,padding:'16px 24px',borderBottom:'1px solid rgba(255,255,255,0.06)' },
  backBtn: { padding:'8px 16px',borderRadius:10,border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontFamily:"'Nunito',sans-serif",fontSize:'0.9rem' },
  roomBadge: { fontFamily:"'Boogaloo',cursive",fontSize:'1.3rem',letterSpacing:'0.1em' },
  prizePool: { marginLeft:'auto',background:'rgba(255,217,61,0.15)',color:'#ffd93d',padding:'6px 16px',borderRadius:20,fontWeight:700 },
  errorBar: { margin:'8px 24px',padding:'10px 16px',borderRadius:10,background:'rgba(255,107,107,0.15)',color:'#ff6b6b',fontSize:'0.9rem' },
  layout: { display:'grid',gridTemplateColumns:'1fr 300px',gap:24,padding:'20px 24px',maxWidth:1000,margin:'0 auto' },
  cardSection: { display:'flex',flexDirection:'column',alignItems:'center',gap:16 },
  statusBar: { fontSize:'0.9rem',color:'rgba(255,255,255,0.5)',textAlign:'center' },
  bingoHeader: { display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,width:'100%',maxWidth:420 },
  colLetter: { fontFamily:"'Boogaloo',cursive",fontSize:'2rem',textAlign:'center',padding:'8px 0' },
  grid: { display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,width:'100%',maxWidth:420 },
  cell: { aspectRatio:'1',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'clamp(1rem,2.5vw,1.5rem)',fontWeight:900,cursor:'pointer',transition:'all 0.15s',background:'#1a1035',border:'2px solid rgba(255,255,255,0.06)',userSelect:'none' },
  freeCell: { background:'linear-gradient(135deg,#6bcb77,#3aaf51)',color:'#0f0a1e',borderColor:'#6bcb77',boxShadow:'0 0 16px rgba(107,203,119,0.4)',fontSize:'0.7em',cursor:'default' },
  markedCell: { background:'linear-gradient(135deg,#ffd93d,#ff9f0a)',color:'#1a1035',borderColor:'#ffd93d',boxShadow:'0 0 18px rgba(255,217,61,0.5)',transform:'scale(1.04)' },
  calledCell: { borderColor:'rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.08)' },
  waiting: { color:'rgba(255,255,255,0.3)',textAlign:'center',padding:'60px 0',fontSize:'1.1rem' },
  actions: { display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:420 },
  btnPay: { padding:'14px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#ffd93d,#ff9f0a)',color:'#1a1035',fontFamily:"'Boogaloo',cursive",fontSize:'1.3rem',cursor:'pointer',letterSpacing:'0.05em' },
  btnReady: { padding:'14px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#6bcb77,#3aaf51)',color:'#0f0a1e',fontFamily:"'Boogaloo',cursive",fontSize:'1.3rem',cursor:'pointer',letterSpacing:'0.05em' },
  btnCall: { padding:'14px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#4d96ff,#7c3aed)',color:'#fff',fontFamily:"'Boogaloo',cursive",fontSize:'1.3rem',cursor:'pointer',letterSpacing:'0.05em' },
  btnBingo: { padding:'14px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#ff6b6b,#ff9f0a)',color:'#fff',fontFamily:"'Boogaloo',cursive",fontSize:'1.5rem',cursor:'pointer',letterSpacing:'0.05em',animation:'none' },
  btnStart: { padding:'14px',borderRadius:12,border:'none',background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.7)',fontFamily:"'Boogaloo',cursive",fontSize:'1.1rem',cursor:'pointer' },
  sidebar: { display:'flex',flexDirection:'column',gap:16 },
  panel: { background:'#1a1035',borderRadius:16,padding:'18px',border:'1px solid rgba(255,255,255,0.07)' },
  panelTitle: { fontFamily:"'Boogaloo',cursive",fontSize:'1rem',color:'rgba(255,255,255,0.4)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12 },
  callDisplay: { display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'8px 0' },
  playerRow: { display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:'0.9rem' },
  playerStatus: { fontSize:'0.75rem',padding:'3px 10px',borderRadius:20,background:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.4)' },
  playerReady: { background:'rgba(107,203,119,0.15)',color:'#6bcb77' },
  calledGrid: { display:'flex',flexWrap:'wrap',gap:4,maxHeight:200,overflowY:'auto' },
  chip: { fontSize:'0.72rem',fontWeight:700,padding:'3px 7px',borderRadius:20,background:'rgba(255,255,255,0.07)' },
  overlay: { position:'fixed',inset:0,background:'rgba(15,10,30,0.9)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,backdropFilter:'blur(6px)' },
  winCard: { background:'#1a1035',borderRadius:24,padding:'48px 40px',textAlign:'center',display:'flex',flexDirection:'column',gap:20,maxWidth:360,border:'1px solid rgba(255,255,255,0.1)' },
  winTitle: { fontFamily:"'Boogaloo',cursive",fontSize:'3.5rem',background:'linear-gradient(135deg,#ffd93d,#ff9f0a,#ff6b6b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' },
  winSub: { color:'rgba(255,255,255,0.7)',fontSize:'1.2rem' },
  btnLeave: { padding:'14px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#4d96ff,#7c3aed)',color:'#fff',fontFamily:"'Boogaloo',cursive",fontSize:'1.2rem',cursor:'pointer' },
};
