import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import Joi from 'joi';
dotenv.config();

const server = express();
server.use(express.json());
server.use(cors());

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

try {
	await mongoClient.connect();
	db = mongoClient.db();
} catch (err) {
	console.log(err);
}

const userSchema = Joi.object({
	name: Joi.string().required(),
});

const messageSchema = Joi.object({
	to: Joi.string().required(),
	text: Joi.string().required(),
	type: Joi.string().valid('message', 'private_message').required(),
});

server.post('/participants', async (req, res) => {
	const { name } = req.body;
	const userValidation = userSchema.validate({ name });

	if (userValidation.error) {
		return res.sendStatus(422);
	}

	if (await db.collection('participants').findOne({ name })) {
		return res.status(409).send('Esse user já está em uso');
	}

	await db.collection('messages').insertOne({
		from: name,
		to: 'Todos',
		text: 'entra na sala...',
		type: 'status',
		time: dayjs(Date.now()).format('hh:mm:ss'),
	});

	await db.collection('participants').insertOne({
		name,
		lastStatus: Date.now(),
	});

	res.sendStatus(201);
});

server.get('/participants', async (req, res) => {
	const users = await db.collection('participants').find().toArray();
	res.send(users);
});

server.post('/messages', async (req, res) => {
	const { to, text, type } = req.body;
	const from = req.headers.user;
	const messageValidation = messageSchema.validate({ to, text, type });

	if (messageValidation.error) {
		return res.sendStatus(422);
	}

	if (!(await db.collection('participants').findOne({ name: from }))) {
		return res.status(422).send('Você não está logado');
	}

	await db.collection('messages').insertOne({
		to,
		text,
		type,
		from,
		time: dayjs(Date.now()).format('hh:mm:ss'),
	});

	res.sendStatus(201);
});

server.get('/messages', async (req, res) => {
	const limit = Number(req.query.limit);
	const user = req.headers.user;
	let lastMessages = [];
	const messages = await db.collection('messages').find().toArray();

	lastMessages = messages.filter((item) => {
		if (item.type === 'message' || item.type === 'status') {
			return true;
		}

		if (
			(item.type === 'private_message' && item.from === user) ||
			item.to === user
		) {
			return true;
		}

		return false;
	});

	if (limit && (limit < 1 || isNaN(limit))) {
		return res.sendStatus(422);
	}

	if (!limit) {
		return res.send(lastMessages);
	}

	lastMessages = lastMessages.slice(-limit);
	res.send(lastMessages);
});

server.post('/status', async (req, res) => {
	const user = req.headers.user;

	if (!(await db.collection('participants').findOne({ name: user }))) {
		return res.status(404).send('Você não está logado');
	}

	await db
		.collection('participants')
		.updateOne({ name: user }, { $set: { lastStatus: Date.now() } });

	res.sendStatus(200);
});

server.delete('/messages/:ID_DA_MENSAGEM', async (req, res) => {
	const { user } = req.headers;
	const id = req.params.ID_DA_MENSAGEM;

	const messageSelected = await db
		.collection('messages')
		.findOne({ _id: ObjectId(id) });
	if (!messageSelected) return res.sendStatus(404);
	if (messageSelected.from !== user) return res.sendStatus(401);

	await db.collection('messages').deleteOne({ _id: ObjectId(id) });

	res.sendStatus(202);
});

server.put('/messages/:ID_DA_MENSAGEM', async (req, res) => {
	const { to, text, type } = req.body;
	const { user } = req.headers;
	const id = req.params.ID_DA_MENSAGEM;
	const editValidation = messageSchema.validate({ to, text, type });

	if (editValidation.error) return res.sendStatus(422);

	if (!(await db.collection('participants').findOne({ name: user })))
		return res.status(422).send('Você não está logado');

	const messageSelected = await db
		.collection('messages')
		.findOne({ _id: ObjectId(id) });
	if (!messageSelected) return res.sendStatus(404);
	if (messageSelected.from !== user) return res.sendStatus(401);

	await db
		.collection('messages')
		.updateOne({ _id: ObjectId(id) }, { $set: { to, text, type } });

	res.send('Mensagem atualizada');
});

function removeParticipant() {
	setInterval(async () => {
		const lastStatusExpired = Date.now() - 10000;

		const users = await db.collection('participants').find().toArray();

		users.forEach(async (item) => {
			if (item.lastStatus < lastStatusExpired) {
				await db.collection('participants').deleteOne({ name: item.name });

				await db.collection('messages').insertOne({
					from: item.name,
					to: 'Todos',
					text: 'sai da sala...',
					type: 'status',
					time: dayjs(Date.now()).format('hh:mm:ss'),
				});
			}
		});
	}, 15000);
}

removeParticipant();

const PORT = 5000;

server.listen(PORT, () =>
	console.log(`O servidor está rodando na porta ${PORT}`)
);
