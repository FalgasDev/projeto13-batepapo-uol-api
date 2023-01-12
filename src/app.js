import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"
dotenv.config()

const server = express()
server.use(express.json())
server.use(cors())

const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db;

await mongoClient.connect()
db = mongoClient.db("batepapo_uol")

server.post('/participants', async (req, res) => {
  const { name } = req.body

  if(await db.collection("participants").findOne({name})) {
    return res.status(409).send("Esse user já está em uso")
  }

  await db.collection("messages").insertOne({
    from: name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: dayjs(Date.now()).format('hh:mm:ss')
  })

  await db.collection("participants").insertOne({
    name,
    lastStatus: Date.now()
  })

  res.sendStatus(201)
})

server.get('/participants', async (req, res) => {
  const users = await db.collection('participants').find().toArray()
  res.send(users)
})

const PORT = 5000

server.listen(PORT, () => console.log(`O servidor está rodando na porta ${PORT}`))