const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { securityRules } = require('firebase-admin');

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
    const usersCollection = db.collection("users");

    console.log("Connected to MongoDB successfully!");

    // GET all lessons
    app.get('/addLesson', async (req, res) => {
        const result = await addLessonCollection.find().sort({ _id: -1 }).toArray();
        res.send(result);
    });
    app.get('/addLesson/:id', async (req, res) => {
        const id = req.params.id
        const result = await addLessonCollection.findOne({ _id: new ObjectId(id) })
        res.send(result)
    })

    app.delete('/addLesson/:id', async (req, res) => {
        const id = req.params.id;
        const result = await addLessonCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
    });

    app.put("/addLesson/:id", async (req, res) => {
        const id = req.params.id;
        const updated = req.body;

        const result = await addLessonCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updated }
        );

        res.send(result);
    });

    // add comment
    app.patch("/addLesson/comment/:id", async (req, res) => {
        const id = req.params.id;
        const { name, photoURL, comment } = req.body;

        const result = await addLessonCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $push: {
                    comments: {
                        name,
                        photoURL,
                        comment,
                        date: new Date(),
                    },
                },
            }
        );

        res.send(result);
    });



    app.get('/myLesson', async (req, res) => {
        const email = req.query.email;
        const query = {};

        if (email) {
            query["author.email"] = email;
        }

        const cursor = addLessonCollection.find(query).sort({ createdAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
    });

    // LIKE button
    app.patch("/addLesson/like/:id", async (req, res) => {
        const { id } = req.params;

        const result = await addLessonCollection.updateOne(
            { _id: new ObjectId(id) },
            { $inc: { likes: 1 } }
        );

        res.send(result);
    });

    // Favoret button
    app.patch("/addLesson/favorite/:id", async (req, res) => {
        const { id } = req.params;
        const result = await addLessonCollection.updateOne(
            { _id: new ObjectId(id) },
            { $inc: { favorites: 1 } }
        );

        res.send(result);
    });



    // POST a new lesson
    app.post('/addLesson', async (req, res) => {
        const lesson = req.body;
        lesson.createdAt = new Date();
        lesson.likes = lesson.likes || 0;
        lesson.favorites = lesson.favorites || 0;
        const result = await addLessonCollection.insertOne(lesson);
        res.send(result);
    });
}

app.post("/users", async (req, res) => {
    const user = req.body;
    const query = { email: user.email };

    const isExist = await usersCollection.findOne(query);

    if (isExist) {
        return res.send({ message: "User already exists" });
    }

    user.isPremium = false;
    user.createdAt = new Date();

    const result = await usersCollection.insertOne(user);
    res.send(result);
});


//   pament related api

app.post("/create-checkout-session", async (req, res) => {
    try {
        const paymentInfo = req.body;

        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "Premium Plan – Lifetime",
                        },
                        unit_amount: 1500, // $15.00
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            customer_email: paymentInfo.senderEmail,
            metadata: {
                paymentId: paymentInfo.paymentId,
            },
            success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
        });

        res.json({ url: session.url });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.patch("/payment-success", async (req, res) => {
    const sessionId = req.query.session_id;
    const session = await stripe.checkout.session.retrieve(sessionId)
    console.log('session retrieve', success)
    if (session.payment_status === "paid") {
        const userId = session.metadata.userId;
        const query = { _id: new ObjectId(userId) }
        const update = {
            $set: {
                isPremium: true,
                premiumSince: new Date(),
                paymentSessionId: session.id,
            }
        }
    }
    res.send({ success: true })
})



run();

app.get('/', (req, res) => {
    res.send('LifeNotes is shifting');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
