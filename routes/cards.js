const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require("../models/users");
const moment = require("moment");
const nodemailer = require("nodemailer");
const Booking = require("../models/bookings");

// Enregistrement de la carte de crédit
router.post("/save/:token", async function (req, res) {
  try {
    // Retrieve the user data from the DB using the token in params
    const {token} = req.params;
    const user = await User.findOne({token});
    // Retrieve the card details from the body
    const {name, number, exp_month, exp_year, cvc} = req.body;
    // Create a card token using Stripe API
    const cardToken = await stripe.tokens.create({card: {name, number, exp_month, exp_year, cvc}});
    // Update the correct user in stripe using his Stripe ID retrieved from the DB and the card token generated
    await stripe.customers.update(user.stripeId, {source: cardToken.id});
    // Return True if successful
    res.json({result: true});
  } catch (error) {
    console.log(error);
  }
});

// Charger la carte
router.post("/pay/:bookingId", async function (req, res) {
  try {
    // Retrieve the reservation details from the body
    const {bookingId} = req.params;
    const booking = await Booking.findById(bookingId).populate(["booker", "restaurant"]);
    const user = booking.booker;
    const restaurant = booking.restaurant;
    // Retrieve the chargeable amount from the Body
    const {chargeableAmount} = req.body;
    const bookingDate = new Date(booking.initialData.start).toISOString();
    // Recherche de l'utilisateur dans Stripe avec son Stripe ID
    const customer = await stripe.customers.retrieve(user.stripeId);
    // Création de la charge sur la CC déjà enregistrée par le client
    const charge = await stripe.charges.create({
      customer: user.stripeId,
      receipt_email: customer.email,
      amount: chargeableAmount * 100,
      currency: "eur",
      description: `Repas du ${moment(bookingDate).format("DD/MM/YYYY")} chez ${restaurant.name}`
    });
    // Update la BDD:
    await Booking.findByIdAndUpdate(bookingId, {paid: true});
    // Création du transporteur de mail avec Nodemailer
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      auth: {
        type: "login", // default
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    });
    // Création et envoi de l'email avec Nodemailer
    await transporter.sendMail({
      from: `"Tablée" <${process.env.NODEMAILER_EMAIL}>`, // sender address
      to: charge.receipt_email,
      subject: "Confirmation de paiement",
      html: `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width" />
          <title>Confirmation de paiement</title>
        </head>
        <body
          style="
            background-color: #1d2c3b;
            font-family: Arial, sans-serif;
            color: #fff;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10px;
          "
        >
          <table
            style="
              background-color: #1d2c3b;
              max-width: 320px;
              border: #cdab82 1px solid;
              padding-left: 20px;
              padding-right: 20px;
              border-radius: 10px;
              margin: 20px auto;
            "
          >
            <tr>
              <td style="text-align: center">
                <img
                  src="https://res.cloudinary.com/tablee/image/upload/v1677928308/Logos%20and%20assets/logo_hy8vpq.jpg"
                  alt="Logo Header Tablée"
                  style="
                    max-width: 100px;
                    margin-top: 20px;
                    border-radius: 10px;
                    border: #cdab82 1px solid;
                  "
                />
              </td>
            </tr>
            <tr>
              <td style="padding-top: 10px; text-align: center">
                <h1 style="color: #cdab82; text-align: center; font-size: large">
                  Un grand merci !
                </h1>
              </td>
            </tr>
            <tr style="font-size: small">
              <td style="text-align: left">
                <p>Bonjour ${user.firstname},</p>
                <p style="padding-bottom: 12px; line-height: 22px">
                  Nous voulions simplement te remercier d'avoir utilisé Tablée pour ta
                  réservation. Nous espérons que notre application t'a été utile et
                  que tu continueras à l'utiliser.
                </p>
              </td>
            </tr>
            <tr>
              <td
                style="
                  border: #cdab82 1px solid;
                  padding-left: 10px;
                  border-radius: 10px;
                  padding-bottom: 10px;
                "
              >
                <h2 style="font-size: large; text-align: center; color: #cdab82">
                  Ce que nous proposons:
                </h2>
                <div style="font-size: small">
                  <p style="margin: 5px">
                    <span style="color: #cdab82">&#10003;</span> Des restaurants
                    choisis avec soin
                  </p>
                  <p style="margin: 5px">
                    <span style="color: #cdab82">&#10003;</span> Un club privé,
                    gratuit à vie*
                  </p>
                  <p style="margin: 5px">
                    <span style="color: #cdab82">&#10003;</span> Une messagerie
                    interne super sécurisée
                  </p>
                  <p style="margin: 5px">
                    <span style="color: #cdab82">&#10003;</span> Un support client de
                    qualité
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 12px; text-align: center">
                <h1
                  style="
                    color: #cdab82;
                    text-align: center;
                    font-size: large;
                    margin-bottom: 12px;
                  "
                >
                  Ton reçu de paiement ?
                </h1>
              </td>
            </tr>
            <tr>
              <td style="text-align: center; font-size: small">
                <p>Tu peux y accéder en cliquant sur ce bouton :</p>
                <p>
                  <a
                    href=${charge.receipt_url}
                    style="
                      display: inline-block;
                      background-color: #cdab82;
                      color: #1d2c3b;
                      padding: 12px 12px;
                      margin: 12px 12px;
                      border-radius: 5px;
                      text-decoration: none;
                    "
                    >Voir le reçu</a
                  >
                </p>
              </td>
            </tr>
            <tr>
              <td style="text-align: center; border-top: #cdab82 1px solid">
                <img
                  src="https://res.cloudinary.com/tablee/image/upload/v1677921416/Logos%20and%20assets/header_logo_g24ylx.png"
                  alt=""
                  style="width: 150px; margin-top: 12px"
                />
              </td>
            </tr>
            <tr>
              <td style="text-align: center">
                <p style="font-size: x-small">
                  <a
                    href="mailto: info@tablee.app"
                    style="
                      text-decoration: underline;
                      font-size: x-small;
                      color: #fff;
                    "
                    >info@tablee.app</a
                  >
                </p>
                <p style="font-size: x-small; font-style: italic">
                  * Sous réserve d'un quota de 10 recommendations par an
                </p>
                <p style="font-size: x-small; margin-top: 20px; color: #cdab82">
                  © 2023 Tous droits réservés
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>

      `
    });
    // Envoi de la réponse au client affichant un popup avec le message de confirmation
    res.json({
      result: true,
      message:
        "Un email de confirmation t'a été envoyé par email !"
    });
  } catch (error) {
    console.log(error);
  }
});

module.exports = router;
