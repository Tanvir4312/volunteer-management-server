require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

app.use(cors({
  origin:['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Verify
const verifyToken = async(req, res, next) =>{
const token = req.cookies.token

if(!token){
  return res.status(401).send({message: 'Unauthorized access'})
}
jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err, decoded) =>{
  if(err){
    return res.status(401).send({message: 'Unauthorized access'})
  }
  else{
    req.user = decoded
  }
} )
  next()
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h2tkvzo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
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
    const volunteerCollection = client
      .db("volunteer-db")
      .collection("volunteer");
    const volunteerRequestCollection = client
      .db("volunteer-db")
      .collection("volunteer-request");

    // JWT Token create and post
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send(token);
    });

    // Jwt token remove by logout
    app.get('/jwt-logout', async(req, res) =>{
      res
      .clearCookie('token',{
        maxAge: 0,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      })
      .send({success: true})
    })

    // Volunteer add post
    app.post("/add-volunteer", verifyToken, async (req, res) => {
      const data = req.body;
   
      const result = await volunteerCollection.insertOne(data);
      res.send(result);
    });

    // volunteer Data get with sort
    app.get("/get-volunteer", verifyToken, async (req, res) => {
      const result = await volunteerCollection
        .find()
        .sort({ date: 1 })
        .toArray();
      res.send(result);
    });

    // get volunteer data with search
    app.get("/volunteer-data", async (req, res) => {
      const search = req.query.search;
      let query = {
        postTitle: {
          $regex: search,
          $options: "i",
        },
      };
      const result = await volunteerCollection.find(query).toArray();
      res.send(result);
    });

    // Volunteer get by id
    app.get("/volunteer-get/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerCollection.findOne(query);
      res.send(result);
    });

    // Save volunteer request data in volunteerRequestCollection
    app.post("/volunteer-request", async (req, res) => {
      const volunteerRequestData = req.body;

      // Same user do not request in same data
      const query = {
        organizer_email: volunteerRequestData.organizer_email,
        id: volunteerRequestData.id,
      };
      const alreadyExist = await volunteerRequestCollection.findOne(query);
      if (alreadyExist) {
        return res.status(400).send("You have already requested in this");
      }
      // Save data
      const result = await volunteerRequestCollection.insertOne(
        volunteerRequestData
      );

      // Decrease No. of volunteers needed
      const filter = { _id: new ObjectId(volunteerRequestData.id) };
      const update = {
        $inc: {
          noOfVolunteersNeeded: -1,
        },
      };
      const updated = await volunteerCollection.updateOne(filter, update);
      res.send(result);
    });

    // get my posts data from from volunteer-collection by email
    app.get("/my-posts/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.user.email

      if(decodedEmail !== email){
        return res.status(403).send({message: 'Forbidden'})
      }
      const query = {
        email,
      };
      const result = await volunteerCollection.find(query).toArray();
      res.send(result);
    });

    // volunteer data update
    app.put("/update-data/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const volunteerData = req.body;

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: volunteerData,
      };
      const result = await volunteerCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // volunteer data delete
    app.delete("/data-delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await volunteerCollection.deleteOne(query);
      res.send(result);
    }); 

    // get my request data by email from Volunteer Request Collection
    app.get("/my-request-posts/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if(decodedEmail !== email){
        return res.status(403).send({message: 'Forbidden'})
      }
      const query = {
        volunteer_email: email,
      };
      const result = await volunteerRequestCollection.find(query).toArray();
      res.send(result);
    });

    // My request data cancel
    app.delete("/my-request-data-cancel/:id",  async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await volunteerRequestCollection.deleteOne(query);
      res.send(result);
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
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

app.get("/", (req, res) => {
  res.send("The volunteer-management server ");
});

app.listen(port, () => {
  console.log("the volunteer management application running on port", port);
});
