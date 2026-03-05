require("dotenv").config()

const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const fs = require("fs")

const app = express()
const server = http.createServer(app)

const io = new Server(server,{
    cors:{origin:"*"}
})

app.use(cors())
app.use(express.json())
app.use(express.static("public"))

/* ---------------- FILE DATABASE ---------------- */

function read(file){
    if(!fs.existsSync(file)) return []
    return JSON.parse(fs.readFileSync(file))
}

function write(file,data){
    fs.writeFileSync(file,JSON.stringify(data,null,2))
}

/* ---------------- HOME ---------------- */

app.get("/",(req,res)=>{
    res.send("🎱 MK BINGO SERVER RUNNING")
})

/* ---------------- TELEGRAM LOGIN ---------------- */

app.post("/login",(req,res)=>{

    const {telegramId,username} = req.body

    let users = read("data/users.json")

    let user = users.find(u=>u.telegramId==telegramId)

    if(!user){

        user={
            id:Date.now(),
            telegramId,
            username,
            balance:10
        }

        users.push(user)

        write("data/users.json",users)
    }

    res.json(user)
})

/* ---------------- DEPOSIT ---------------- */

app.post("/deposit",(req,res)=>{

    const {userId,amount,method} = req.body

    let deposits = read("data/deposits.json")

    const dep={
        id:Date.now(),
        userId,
        amount,
        method,
        status:"pending",
        date:new Date()
    }

    deposits.push(dep)

    write("data/deposits.json",deposits)

    res.json({message:"Deposit request sent"})
})

/* ---------------- WITHDRAW ---------------- */

app.post("/withdraw",(req,res)=>{

    const {userId,amount} = req.body

    let withdrawals = read("data/withdrawals.json")

    withdrawals.push({
        id:Date.now(),
        userId,
        amount,
        status:"pending",
        date:new Date()
    })

    write("data/withdrawals.json",withdrawals)

    res.json({message:"Withdraw request sent"})
})

/* ---------------- ADMIN APPROVE DEPOSIT ---------------- */

app.post("/admin/approveDeposit",(req,res)=>{

    const {depositId} = req.body

    let deposits = read("data/deposits.json")
    let users = read("data/users.json")

    let dep = deposits.find(d=>d.id==depositId)

    if(dep){

        dep.status="approved"

        let user = users.find(u=>u.id==dep.userId)

        if(user){
            user.balance += dep.amount
        }

        write("data/deposits.json",deposits)
        write("data/users.json",users)
    }

    res.json({success:true})
})

/* ---------------- BINGO GAME ---------------- */

let players=[]
let numbers=[]
let called=[]

function startGame(){

    numbers = Array.from({length:75},(_,i)=>i+1)
    called=[]
}

function callNumber(){

    if(numbers.length==0) return

    const index=Math.floor(Math.random()*numbers.length)

    const num=numbers.splice(index,1)[0]

    called.push(num)

    io.emit("number",num)
}

/* ---------------- SOCKET ---------------- */

io.on("connection",(socket)=>{

    console.log("Player connected")

    socket.on("join",(player)=>{

        players.push(player)

        io.emit("players",players)

    })

    socket.on("bingo",(player)=>{

        io.emit("winner",player)

        let history = read("data/history.json")

        history.push({
            winner:player,
            date:new Date()
        })

        write("data/history.json",history)
    })

    socket.on("disconnect",()=>{
        console.log("Player disconnected")
    })
})

/* ---------------- ADMIN GAME CONTROL ---------------- */

app.get("/admin/start",(req,res)=>{

    startGame()

    res.send("Game started")
})

app.get("/admin/call",(req,res)=>{

    callNumber()

    res.send("Number called")
})

/* ---------------- HISTORY ---------------- */

app.get("/history",(req,res)=>{

    res.json(read("data/history.json"))
})

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 8080

server.listen(PORT,"0.0.0.0",()=>{

    console.log("🎱 MK BINGO SERVER RUNNING")

})