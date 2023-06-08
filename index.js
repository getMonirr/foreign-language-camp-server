const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");

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

    // generate jwt token
    app.post("/jwt", (req, res) => {
      const userInfo = req.body;
      const token = jwt.sign(userInfo, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    // get all classes
    app.get("/classes", async (req, res) => {
      const result = await classColl.find().toArray();
      res.send(result);
    });

    // get all instructors
    app.get("/instructors", async (req, res) => {
      const result = await instructorColl.find().toArray();
      res.send(result);
    });

    // get all class from selected collection for individual user
    app.get("/selectedCarts", async (req, res) => {
      const userEmail = req.query.email;
      const result = await selectedColl.find({ email: userEmail }).toArray();
      res.send(result);
    });

    // add class to selected collection
    app.post("/selectedCarts", async (req, res) => {
      const result = await selectedColl.insertOne(req.body);
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