require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

    // Volunteer add post
    app.post("/add-volunteer", async (req, res) => {
      const data = req.body;
      const result = await volunteerCollection.insertOne(data);
      res.send(result);
    });

    // volunteer Data get with sort
    app.get("/get-volunteer", async (req, res) => {
      const result = await volunteerCollection
        .find()
        .sort({ date: 1 })
        .toArray();
      res.send(result); 
    });

    // get volunteer data with search
    app.get('/volunteer-data', async(req, res) =>{
      const search = req.query.search;
      let query = {
        postTitle: {
          $regex: search,
          $options: 'i'
        }
      }
      const result = await volunteerCollection.find(query).toArray()
      res.send(result)
    })

    // Volunteer get by id
    app.get("/volunteer-get/:id", async (req, res) => {
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
      const updated = await volunteerCollection.updateOne(filter, update)
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
