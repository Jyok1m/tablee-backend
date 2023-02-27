var express = require("express");
var router = express.Router();

const User = require("../models/users");

const uid2 = require("uid2");
const bcrypt = require("bcrypt");
const uniqid = require("uniqid");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

const { checkBody } = require("../modules/checkBody");
const { passwordRegex, emailRegex } = require("../modules/regex");

//. Upload file
router.post("/upload", async (req, res) => {
  const photoPath = `./tmp/${uniqid()}.jpg`;
  const resultMove = await req.files.photoFromFront.mv(photoPath);

  if (!resultMove) {
    const resultCloudinary = await cloudinary.uploader.upload(photoPath);

    fs.unlinkSync(photoPath);
    res.json({ result: true, url: resultCloudinary.secure_url });
  } else {
    res.json({ result: false, error: resultMove });
  }
});

//. Signup
router.post("/signup", function (req, res) {
  const { username, firstname, email, password, studentCard } = req.body;

  // Check if any of the fields is empty or null
  if (!checkBody([username, firstname, email, password])) {
    res.json({ result: false, error: "Champs manquants ou vides." });
    return;
  }

  // Check if the password is strong enough -> 8 characters, 1 lowercase, 1 uppercase, 1 numeric, 1 special
  if (!passwordRegex.test(password)) {
    res.json({ result: false, error: "Mot de passe pas assez sécurisé." });
    return;
  }

  // Block certain domains -> gmail, yahoo, hotmail, aol, msn, icloud, wanadoo, orange, free, live, outlook etc...
  if (!emailRegex.test(email)) {
    res.json({ result: false, error: "Adresse email étudiant non valide." });
    return;
  }

  // Check if the student card has been saved
  if (!checkBody([studentCard])) {
    res.json({ result: false, error: "Carte étudiant manquante." });
    return;
  }

  // Check if the user is already in the database:
  User.findOne({ username }).then((data) => {
    if (data) {
      res.json({
        result: false,
        error: "Utilisateur(trice) déjà inscrit(e).",
      });
    } else {
      // If all the tests have been validated, hash the password:
      const hash = bcrypt.hashSync(password, 10);

      // Save the info in the database:
      const newUser = new User({
        firstname,
        username,
        password: hash,
        token: uid2(32),
      });

      newUser.save().then(() => {
        res.json({ result: true, token: newUser.token });
      });
    }
  });
});

//. Signin
router.post("/signin", function (req, res) {
  const { username, password } = req.body;
  console.log({ username, password });

  // Check if the fields are empty or null:
  if (!checkBody([username, password])) {
    res.json({
      result: false,
      errorSrc: "field",
      error: "Champs manquants ou vides.",
    });
    return;
  }

  // Check if the user is already in the database:
  User.findOne({ username }).then((data) => {
    if (!data) {
      res.json({
        result: false,
        errorSrc: "username",
        error: "Utilisateur(trice) non reconnu(e).",
      });
    } else {
      if (bcrypt.compareSync(password, data.password)) {
        res.json({ result: true, token: data.token });
      } else {
        res.json({
          result: false,
          errorSrc: "password",
          error: "Mot de passe non valide.",
        });
      }
    }
  });
});

//. Get a single user's infos
router.get("/:token", function (req, res) {
  const { token } = req.params;

  User.findOne({ token }).then((data) => {
    res.json({ result: true, user: data });
  });
});

//. Get all users' infos
router.get("/", function (req, res) {
  User.find({}).then((data) => res.json({ allUsers: data }));
});

// Route export:
module.exports = router;
