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

let usersCollection;

async function run() {
    await client.connect();
    const db = client.db('life_notes_db');
    const addLessonCollection = db.collection('addLesson');
    usersCollection = db.collection("users");
    const reportsCollection = db.collection("reports");
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
    //  reports api
    app.post("/reports", async (req, res) => {
        const report = req.body;
        report.createdAt = new Date();

        const result = await reportsCollection.insertOne(report);
        res.send({ success: true, insertedId: result.insertedId });
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
        const { email } = req.body;

        const lesson = await addLessonCollection.findOne({ _id: new ObjectId(id) });

        const alreadyLiked = lesson.likes.includes(email);

        const update = alreadyLiked
            ? {
                $pull: { likes: email },
                $inc: { likesCount: -1 },
            }
            : {
                $addToSet: { likes: email },
                $inc: { likesCount: 1 },
            };

        const result = await addLessonCollection.updateOne(
            { _id: new ObjectId(id) },
            update
        );

        res.send(result);
    });


    // Favoret button
    app.patch("/addLesson/favorite/:id", async (req, res) => {
        const { id } = req.params;
        const { email } = req.body;
        const lesson = await addLessonCollection.findOne({ _id: new ObjectId(id) });
        const alreadyFav = lesson.favorites.includes(email);
        const update = alreadyFav
            ? {
                $pull: { favorites: email },
                $inc: { favoritesCount: -1 },
            }
            : {
                $addToSet: { favorites: email },
                $inc: { favoritesCount: 1 },
            };

        const result = await addLessonCollection.updateOne(
            { _id: new ObjectId(id) },
            update
        );

        res.send(result);
    });

    app.get("/favorites", async (req, res) => {
        const email = req.query.email;

        const result = await addLessonCollection
            .find({ favorites: email })
            .toArray();

        res.send(result);
    });


    // save or update user in db
    app.post("/users", async (req, res) => {
        const user = req.body;

        const result = await usersCollection.updateOne(
            { email: user.email },
            { $set: user },
            { upsert: true }
        );

        res.send(result);
    });

    app.get("/users", async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
    });



    // ✅ specific first
    app.get('/users/role/:email', async (req, res) => {
        const email = req.params.email;
        const result = await usersCollection.findOne({ email });
        res.send({ role: result?.role });
    });

    // ✅ generic last
    app.get("/users/:email", async (req, res) => {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        res.send(user);
    });

    // POST a new lesson
    app.post("/addLesson", async (req, res) => {
        const lesson = req.body;

        lesson.createdAt = new Date();
        lesson.likes = [];
        lesson.favorites = [];
        lesson.comments = [];

        const result = await addLessonCollection.insertOne(lesson);
        res.send(result);
    });

}


//   pament related api


app.post("/create-checkout-session", async (req, res) => {
    const BDT_PRICE = 1500;
    const USD_RATE = 126.89;
    const USD_AMOUNT = Math.round((BDT_PRICE / USD_RATE) * 100);
    try {
        const { senderEmail } = req.body;

        if (!senderEmail) {
            return res.status(400).send({ error: "Email is required" });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        unit_amount: USD_AMOUNT,
                        product_data: {
                            name: "Premium Membership",
                            description: "Lifetime access to premium features"
                        },
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            customer_email: senderEmail,
            metadata: {
                email: senderEmail
            },
            success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.SITE_DOMAIN}/payment-cancel`,
        });

        res.send({ url: session.url });
    } catch (error) {
        console.error("Stripe Session Error:", error);
        res.status(500).send({ error: error.message });
    }
});

// 1️⃣ Payment verification & DB update
app.patch("/payment-success", async (req, res) => {
    const sessionId = req.query.session_id;
    console.log(sessionId)
    if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== "paid") {
            return res.status(400).json({ error: "Payment not verified" });
        }
        const userEmail = session.metadata?.email;
        console.log(userEmail)
        if (!userEmail) {
            return res.status(400).json({ error: "Email not found in session metadata" });
        }
        if (!usersCollection) {
            return res.status(500).json({ error: "Database collection not initialized" });
        }
        const result = await usersCollection.updateOne(
            { email: userEmail },
            { $set: { isPremium: true } }
        );
        console.log("MongoDB update result:", result);

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ success: true, message: "Premium status updated!" });

    } catch (err) {
        console.error("Payment verification error:", err);
        res.status(500).json({ error: "Server error", details: err.message });
    }
});


run();

app.get('/', (req, res) => {
    res.send('LifeNotes is shifting');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
