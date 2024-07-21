const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection
mongoose.connect(
  "mongodb+srv://hospital:z2swpgr4Ken6sdGz@cluster1.c3wrh.mongodb.net/nesteddocs",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Documentation Schema
const docSchema = new mongoose.Schema({
  title: String,
  content: String,
  isParent: { type: Boolean, default: true },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Document",
    default: null,
  },
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
});

const Document = mongoose.model("Document", docSchema);

// Routes
const populateChildren = async (doc) => {
  const populatedDoc = await Document.findById(doc._id).populate("children");
  const populatedChildren = await Promise.all(
    populatedDoc.children.map((child) => populateChildren(child))
  );
  populatedDoc.children = populatedChildren;
  return populatedDoc;
};

app.get("/api/docs", async (req, res) => {
  try {
    const docs = await Document.find({ isParent: true });
    const populatedDocs = await Promise.all(
      docs.map((doc) => populateChildren(doc))
    );
    res.json(populatedDocs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/docs", async (req, res) => {
  const { title, content, parentId } = req.body;

  // Check if parentId is valid or set to null
  let validParentId = null;
  if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
    validParentId = new mongoose.Types.ObjectId(parentId);
  }

  const isParent = !validParentId;
  const doc = new Document({
    title,
    content,
    isParent,
    parentId: validParentId,
  });

  try {
    await doc.save();

    if (validParentId) {
      const parentDoc = await Document.findById(validParentId);
      parentDoc.children.push(doc);
      await parentDoc.save();
    }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/docs/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate("children");
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
