const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

// create app
const app = express();
const port = process.env.PORT || 4000;

// middleware
app.use(cors());
app.use(express.json());

// routes
app.get("/", (req, res) => {
  res.send("foreign language camp server is running...");
});

// authGuard
const authGuard = (req, res, next) => {
  // check authorization
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "authorization failed authorization" });
  }

  // verify token
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET_KEY, (error, decode) => {
    if (error) {
      return res
        .status(402)
        .send({ error: true, message: "authorization failed verify token" });
    }

    // set data to body and go to next
    req.decode = decode;
    next();
  });
};

// mongodb start

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.d7lse9s.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // camp start

    // create collection
    const database = client.db("foreignDB");

    const classColl = database.collection("classes");
    const instructorColl = database.collection("instructors");
    const selectedColl = database.collection("selectedCart");
    const usersColl = database.collection("users");
    const paymentsColl = database.collection("payments");

    // generate jwt token
    app.post("/jwt", (req, res) => {
      const userInfo = req.body;
      const token = jwt.sign(userInfo, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    // verify admin
    const adminGuard = async (req, res, next) => {
      const targetUser = await usersColl.findOne({ email: req.decode.email });
      if (!targetUser?.role === "admin") {
        return res
          .status(401)
          .send({ error: true, message: "unauthorize access" });
      }
      next();
    };

    // get user role
    app.get("/users", async (req, res) => {
      const userEmail = req.query.email;
      const result = await usersColl.findOne({ email: userEmail });
      res.send(result);
    });

    // put a user
    app.put("/users", async (req, res) => {
      const userEmail = req.query.email;
      const body = req.body;
      const query = { email: userEmail };

      const existingUser = await usersColl.findOne(query);

      if (existingUser) {
        res.send({ exist: true });
      } else {
        const newUser = {
          role: "student",
          ...body,
        };

        const result = await usersColl.insertOne(newUser);
        res.send(result);
      }
    });

    // patch a user
    app.patch("/users", async (req, res) => {
      const userEmail = req.query.email;
      const body = req.body;
      const query = { email: userEmail };
      const updateDoc = {
        $set: {
          ...body,
        },
      };
      const result = await usersColl.updateOne(query, updateDoc);
      res.send(result);
    });

    // get all users for admin
    app.get("/all-users", authGuard, adminGuard, async (req, res) => {
      const userEmail = req.query.email;
      if (userEmail !== req?.decode?.email) {
        return res
          .status(403)
          .send({ error: true, message: "unAuthorized access" });
      }

      const result = await usersColl.find().toArray();
      res.send(result);
    });

    // get all popular classes limit 6
    app.get("/popularClasses", async (req, res) => {
      const result = await classColl
        .find()
        .sort({ enrolledStudents: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // get all class for all user
    app.get("/all-classes", async (req, res) => {
      const result = await classColl.find({ status: "approved" }).toArray();

      res.send(result);
    });

    // get all class for admin
    app.get("/admin-classes", authGuard, adminGuard, async (req, res) => {
      const result = await classColl.find().toArray();

      res.send(result);
    });

    // update status and add feedback properties of a class
    app.patch("/admin-classes/:id", authGuard, adminGuard, async (req, res) => {
      const userEmail = req.query.email;

      if (userEmail !== req?.decode?.email) {
        return res
          .status(403)
          .send({ error: true, message: "unAuthorized access" });
      }
      const query = { _id: new ObjectId(req.params.id) };
      const updateDoc = {
        $set: {
          ...req.body,
        },
      };

      const result = await classColl.updateOne(query, updateDoc);
      res.send(result);
    });

    // verify instructor
    const instructorGuard = async (req, res, next) => {
      const targetUser = await usersColl.findOne({ email: req.decode.email });
      if (!targetUser?.role === "instructor") {
        return res
          .status(401)
          .send({ error: true, message: "unauthorize access" });
      }
      next();
    };

    // get all classes by instructor email
    app.get("/classes", authGuard, instructorGuard, async (req, res) => {
      const userEmail = req.query.email;
      const result = await classColl
        .find({ instructorEmail: userEmail })
        .toArray();
      res.send(result);
    });

    // post a class
    app.post("/classes", authGuard, instructorGuard, async (req, res) => {
      const result = await classColl.insertOne(req.body);
      res.send(result);
    });

    // get all popular instructors limit 6
    app.get("/popularInstructors", async (req, res) => {
      const result = await instructorColl
        .find()
        .sort({ studentsEnrolled: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // get all instructors
    app.get("/instructors", async (req, res) => {
      const result = await instructorColl.find().toArray();
      res.send(result);
    });

    // get all class from selected collection for individual user
    app.get("/selectedCarts", authGuard, async (req, res) => {
      const userEmail = req.query.email;

      if (userEmail !== req?.decode?.email) {
        return res
          .status(403)
          .send({ error: true, message: "unAuthorized access" });
      }

      const result = await selectedColl.find({ email: userEmail }).toArray();
      res.send(result);
    });
    // get a class price from selected cart
    app.get("/selectedCarts/:id", authGuard, async (req, res) => {
      const userEmail = req.query.email;

      if (userEmail !== req?.decode?.email) {
        return res
          .status(403)
          .send({ error: true, message: "unAuthorized access" });
      }
      const result = await selectedColl.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // create a payment intent
    app.post("/create-payment-intent", authGuard, async (req, res) => {
      const { price } = req.body;
      const totalPrice = price * 100;
      if (req.decode.email !== req.query.email) {
        return res
          .status(403)
          .send({ error: true, message: "unAuthorized access" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalPrice,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // add payment history to payments collection
    app.post("/payments", authGuard, async (req, res) => {
      await selectedColl.deleteOne({
        _id: new ObjectId(req?.body?.cartId),
      });

      // minus a seats
      const targetClass = await classColl.findOne({
        _id: new ObjectId(req?.body?.classId),
      });

      if (targetClass) {
        await classColl.updateOne(
          { _id: new ObjectId(req?.body?.classId) },
          { $inc: { seats: -1, enrolledStudents: 1 } }
        );
      }
      const result = await paymentsColl.insertOne(req.body);
      res.send(result);
    });

    // get payment history
    app.get("/payments", authGuard, async (req, res) => {
      if (req.decode.email !== req.query.email) {
        return res
          .status(403)
          .send({ error: true, message: "unAuthorized access" });
      }

      const result = await paymentsColl
        .find({ email: req.query.email })
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // add class to selected collection
    app.post("/selectedCarts", async (req, res) => {
      const result = await selectedColl.insertOne(req.body);
      res.send(result);
    });

    // delete a class from selected cart
    app.delete("/selectedCarts/:id", authGuard, async (req, res) => {
      const userEmail = req.query.email;

      if (userEmail !== req?.decode?.email) {
        return res
          .status(403)
          .send({ error: true, message: "unAuthorized access" });
      }
      const result = await selectedColl.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // get enrolled classes
    app.get("/enrolledClasses", authGuard, async (req, res) => {
      const userEmail = req.query.email;

      if (userEmail !== req?.decode?.email) {
        return res
          .status(403)
          .send({ error: true, message: "unAuthorized access" });
      }

      const result = await paymentsColl
        .find({ email: userEmail })
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // camp end

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// mongodb end

app.listen(port, () => {
  console.log(`foreign language camp server is running on port ${port}`);
});
