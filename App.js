import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Auth from './pages/Auth';
import Lobby from './pages/Lobby';
import Game from './pages/Game';

function AppInner() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('lobby'); // lobby | game
  const [roomCode, setRoomCode] = useState('');

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#0f0a1e',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{fontFamily:"'Boogaloo',cursive",fontSize:'3rem',background:'linear-gradient(135deg,#ff6b6b,#ffd93d)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Loading...</div>
    </div>
  );

  if (!user) return <Auth />;

  if (page === 'game') return (
    <Game roomCode={roomCode} onLeave={() => setPage('lobby')} />
  );

  return (
    <Lobby
      onJoinRoom={(code) => { setRoomCode(code); setPage('game'); }}
      onCreateRoom={(code) => { setRoomCode(code); setPage('game'); }}
    />
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}
