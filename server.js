const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));

app.use(
  session({
    secret: "sistec_secret",
    resave: false,
    saveUninitialized: true
  })
);

const db = new sqlite3.Database("database.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      temperature TEXT,
      humidity TEXT,
      time TEXT,
      date TEXT
    )
  `);
});

function getIndianTime() {
  const now = new Date();

  const time = now.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata"
  });

  const date = now.toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata"
  });

  return { time, date };
}

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users(name,email,password) VALUES(?,?,?)`,
    [name, email, hashedPassword],
    function (err) {
      if (err) {
        return res.send("Error");
      }

      res.send("Registered Successfully");
    }
  );
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    `SELECT * FROM users WHERE email=?`,
    [email],
    async (err, user) => {
      if (!user) {
        return res.send("User Not Found");
      }

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return res.send("Wrong Password");
      }

      req.session.user = user;

      res.json({
        success: true,
        name: user.name
      });
    }
  );
});

app.get("/get-user", (req, res) => {
  if (req.session.user) {
    res.json({
      loggedIn: true,
      name: req.session.user.name
    });
  } else {
    res.json({
      loggedIn: false
    });
  }
});

app.post("/save-data", (req, res) => {
  const { temperature, humidity } = req.body;

  const { time, date } = getIndianTime();

  db.run(
    `INSERT INTO records(temperature,humidity,time,date) VALUES(?,?,?,?)`,
    [temperature, humidity, time, date],
    function (err) {
      if (err) {
        return res.send("Error Saving");
      }

      res.send("Data Saved");
    }
  );
});

app.get("/latest-data", (req, res) => {
  db.get(
    `SELECT * FROM records ORDER BY id DESC LIMIT 1`,
    [],
    (err, row) => {
      res.json(row);
    }
  );
});

app.get("/all-records", (req, res) => {
  db.all(
    `SELECT * FROM records ORDER BY id DESC`,
    [],
    (err, rows) => {
      res.json(rows);
    }
  );
});

app.delete("/delete-record/:id", (req, res) => {
  const id = req.params.id;

  db.run(`DELETE FROM records WHERE id=?`, [id], function (err) {
    res.send("Deleted");
  });
});

app.post("/save-lcd-text", (req, res) => {
  const { text } = req.body;

  fs.writeFileSync("lcd.txt", text);

  res.send("LCD Text Saved");
});

app.get("/get-lcd-text", (req, res) => {
  const text = fs.readFileSync("lcd.txt", "utf8");

  res.send(text);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server Running");
});