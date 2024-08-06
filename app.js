const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const mongoose = require("./modules/mongoose");
const SMS = require("./modules/sms");
const EMAIL = require("./modules/nodemailer");
const User = mongoose.User;

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(session({
    secret: 'security-code',
    resave: false,
    saveUninitialized: true
}));

var PORT = process.env.PORT || 3000;

app.post("/register", async (req, res) => {
    const { surname, last_name, other_name, username, password, email, emailOTP, phone, phoneOTP } = req.body;

    try {
        const user = new User({ surname, last_name, other_name, username, password, email, phone });

        if (emailOTP !== req.session.emailOTP || phoneOTP !== req.session.phoneOTP) {
            return res.status(400).send("Invalid OTP");
        }

        user.emailVerified = true;
        user.phoneVerified = true;

        await user.save();
        res.send("User registered successfully");
    } catch (error) {
        res.status(400).send(error.message);
    }
});

app.post("/request-email-otp", async (req, res) => {
    const { email } = req.body;
    const emailOTP = Math.floor(100000 + Math.random() * 900000).toString();

    req.session.emailOTP = emailOTP;

    try {
        await EMAIL.sendOTP(email, `Your verification code is ${emailOTP}`);
        res.send("Email OTP sent");
    } catch (error) {
        res.status(500).send("Failed to send email OTP");
    }
});

app.post("/request-phone-otp", async (req, res) => {
    const { phone } = req.body;
    const phoneOTP = Math.floor(100000 + Math.random() * 900000).toString();

    req.session.phoneOTP = phoneOTP;
    console.log(phone)

    try {
        const sending = await SMS.sendSMS(phone, `Your verification code is ${phoneOTP}`);
        console.log(sending);
        res.send("Phone OTP sent");
    } catch (error) {
        res.status(500).send("Failed to send phone OTP");
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        if(typeof req.session.user !== "undefined"){
            return res.send("Please You are already logged in, please enter the OTP")
        }
        if (!user || !(await user.comparePassword(password))) {
            return res.status(400).send("Invalid username or password");
        } 

        req.session.user = user;
        res.send("Login successful. Please verify OTP.");
    } catch (error) {
        res.status(500).send("Failed to login");
    }
});

app.post("/request-otp", async (req, res) => {
    const { username } = req.body;

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).send("User not found");
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        req.session.otp = otp;

        if (user.emailVerified) {
            await EMAIL.sendOTP(user.email, `Your verification code is ${otp}`);
        } else if (user.phoneVerified) {
            await SMS.sendSMS(user.phone, `Your verification code is ${otp}`);
        }

        res.send("OTP sent");
    } catch (error) {
        res.status(500).send("Failed to send OTP");
    }
});

app.post("/verify-login", async (req, res) => {
    const { otp } = req.body;

    if (otp !== req.session.otp) {
        return res.status(400).send("Invalid OTP");
    }

    req.session.otp = null;
    res.send("Login verified");
});

app.listen(PORT, () => {
    console.log("I am listening on", PORT);
});
