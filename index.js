const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Correct Stripe initialization
const stripe = require('stripe')(process.env.STRIPE_SECR);

// Middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.k80acns.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    await client.connect();
    const db = client.db('life_notes_db');
    const addLessonCollection = db.collection('addLesson');

    console.log("Connected to MongoDB successfully!");

    // GET all lessons
    app.get('/addLesson', async (req, res) => {
        const result = await addLessonCollection.find().toArray();
        res.send(result);
    });
    app.get('/addLesson/:id', async (req, res) => {
        const id = req.params.id
        const result = await addLessonCollection.findOne({ _id: new ObjectId(id) })
        res.send(result)
    })

    // POST a new lesson
    app.post('/addLesson', async (req, res) => {
        const lesson = req.body;
        lesson.createdAt = new Date();
        const result = await addLessonCollection.insertOne(lesson);
        res.send(result);
    });
}

run();

app.get('/', (req, res) => {
    res.send('LifeNotes is shifting');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
