import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"
import Joi from "joi"
dotenv.config()

const server = express()
server.use(express.json())
server.use(cors())

const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db;

await mongoClient.connect()
db = mongoClient.db()

const userSchema = Joi.object({
  name: Joi.string().required()
})

const messageSchema = Joi.object({
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().valid('message', 'private_message')
})

server.post('/participants', async (req, res) => {
  const { name } = req.body
  const userValidation = userSchema.validate({ name })

  if(userValidation.error) {
    return res.sendStatus(422)
  }

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

server.post('/messages', async (req, res) => {
  const { to, text, type } = req.body
  const from = req.headers.user
  const messageValidation = messageSchema.validate({to, text, type})

  if(messageValidation.error) {
    return res.sendStatus(422)
  }

  if(!await db.collection("participants").findOne({name: from})) {
    return res.status(422).send('Você não está logado')
  }

  await db.collection('messages').insertOne({
    to,
    text,
    type,
    from,
    time: dayjs(Date.now()).format('hh:mm:ss')
  })

  res.sendStatus(201)
})

server.get('/messages', async (req, res) => {
  const messages = await db.collection('messages').find().toArray()
  res.send(messages)
})

const PORT = 5000

server.listen(PORT, () => console.log(`O servidor está rodando na porta ${PORT}`))