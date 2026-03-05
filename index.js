require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

const io = new Server(server,{
  cors:{ origin:"*", methods:["GET","POST"] }
});

app.use(cors());
app.use(express.json());

/* ------------------------------
   BASIC ROUTE (Fix Cannot GET /)
--------------------------------*/
app.get("/",(req,res)=>{
  res.send("🎱 MK BINGO SERVER RUNNING");
});

/* ------------------------------
   IN MEMORY DATABASE
--------------------------------*/
const users = {};
const rooms = {};

const JWT_SECRET = "mk_bingo_secret";

/* ------------------------------
   HELPERS
--------------------------------*/

function generateCard(){
  const ranges=[[1,15],[16,30],[31,45],[46,60],[61,75]];
  const card=ranges.map(([lo,hi])=>{
    const nums=[];
    while(nums.length<5){
      const n=Math.floor(Math.random()*(hi-lo+1))+lo;
      if(!nums.includes(n)) nums.push(n);
    }
    return nums;
  });

  card[2][2]=0;
  return card;
}

function generatePool(){
  const arr=Array.from({length:75},(_,i)=>i+1);
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

/* ------------------------------
   AUTH
--------------------------------*/

app.post("/api/register",async(req,res)=>{

  const {username,email,password}=req.body;

  if(!username||!email||!password)
  return res.status(400).json({error:"Missing fields"});

  const id=uuidv4();
  const hash=await bcrypt.hash(password,10);

  users[id]={
    id,
    username,
    email,
    password:hash,
    balance:100,
    gamesWon:0,
    gamesPlayed:0
  };

  const token=jwt.sign({id},JWT_SECRET);

  res.json({token,user:{id,username,email,balance:100}});
});


app.post("/api/login",async(req,res)=>{

  const {email,password}=req.body;

  const user=Object.values(users).find(u=>u.email===email);

  if(!user) return res.status(400).json({error:"Invalid login"});

  const ok=await bcrypt.compare(password,user.password);

  if(!ok) return res.status(400).json({error:"Invalid login"});

  const token=jwt.sign({id:user.id},JWT_SECRET);

  res.json({
    token,
    user:{
      id:user.id,
      username:user.username,
      email:user.email,
      balance:user.balance
    }
  });

});


/* ------------------------------
   ROOMS
--------------------------------*/

app.post("/api/create-room",(req,res)=>{

  const code=Math.random().toString(36).substring(2,7).toUpperCase();

  rooms[code]={
    code,
    host:null,
    players:{},
    pool:generatePool(),
    called:[],
    status:"waiting"
  };

  res.json({code});
});

app.get("/api/rooms",(req,res)=>{
  res.json(Object.values(rooms));
});


/* ------------------------------
   SOCKET.IO
--------------------------------*/

io.on("connection",(socket)=>{

  console.log("Player connected");

  socket.on("joinRoom",({roomCode,username})=>{

    const room=rooms[roomCode];
    if(!room) return;

    socket.join(roomCode);

    room.players[socket.id]={
      id:socket.id,
      username,
      card:generateCard(),
      marked:Array.from({length:5},()=>Array(5).fill(false))
    };

    socket.emit("card",room.players[socket.id].card);

    io.to(roomCode).emit("players",Object.values(room.players));

  });

  socket.on("callNumber",(roomCode)=>{

    const room=rooms[roomCode];
    if(!room) return;

    const num=room.pool.pop();

    room.called.push(num);

    io.to(roomCode).emit("number",num);

  });

  socket.on("disconnect",()=>{
    console.log("Player disconnected");
  });

});


/* ------------------------------
   START SERVER
--------------------------------*/

const PORT=process.env.PORT||8080;

server.listen(PORT,()=>{
  console.log(`🎱 Bingo server running on port ${PORT}`);
});