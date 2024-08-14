// app.js (including second auth routes)
const express = require('express');
const path = require('path');
const { User, Types } = require('./modules/mongoose');
const { sendOTP } = require('./modules/nodemailer');
const { sendSMS } = require('./modules/sms');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

//Register
app.post('/register', async (req, res) => {
    const { surname, first_name, other_name, username, email, phone, password } = req.body;
    console.log(req.body)
    try {
        // Check if email or username already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Email or username already taken.' });
        }

        // Generate OTPs
        const emailOTP = crypto.randomInt(100000, 999999).toString();
        const phoneOTP = crypto.randomInt(100000, 999999).toString();

        // Save user with unverified email and phone
        const newUser = new User({
            surname,
            last_name: first_name,
            other_name: other_name,
            username,
            email,
            phone,
            password,
            emailOTP,
            phoneOTP,
            emailVerified: false,
            phoneVerified: false
        });
        await newUser.save();

        // Send OTPs
        await sendOTP(email, `Your email verification code is ${emailOTP}`);
        // await sendSMS(phone, `Your phone verification code is ${phoneOTP}`);

        res.status(201).json({ 
            message: 'Registration successful. Please verify your email.', 
            success: true, 
            userId: newUser._id.toString(),
            auth: newUser.email,
            number: newUser.phone
        });
    } catch (error) {
        res.status(500).json({ message: error.message,success:false });
    }
});

// Login Route
app.post('/login', async (req, res) => {
    const { 'username-l': username, 'password-l': password } = req.body;
    console.log(req.body)
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

        if (!user.emailVerified || !user.phoneVerified) {
            return res.status(403).json({ message: 'Please verify your email and phone number before logging in.', 
                userId:user._id.toString(),
                email:user.email,
                phone:user.phone,
                verified: false,
                eVerified: user.emailVerified,
            });
        }

        // Generate a new OTP for second authentication
        const secondAuthOTP = user.generateSecondAuthOTP();
        await user.save();

        // Send the second authentication OTP via email or SMS
        await sendOTP(user.email, `Your second authentication code is ${secondAuthOTP}`);
        await sendSMS(user.phone, `Your second authentication code is ${secondAuthOTP}`);

        res.status(200).json({ 
            success: true,
            message: 'Second authentication OTP sent. Please verify.', 
            userId: user._id.toString(),
            auth: user.phone
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Second Authentication Route
app.post('/second-auth', async (req, res) => {
    const { userId, otp } = req.body;

    try {
        const user = await User.findById(new Types(userId));
        if (!user) return res.status(404).json({ message: 'User not found.' });

        if (user.secondAuthOTP === otp) {
            // Issue JWT for session management
            const token = jwt.sign({ id: user._id, username: user.username }, 'secretKey', { expiresIn: '1h' });
            user.secondAuthOTP = null; // Clear OTP after successful second auth
            await user.save();

            res.status(200).json({ token, success:true, message:"You have successfully logged in." });
        } else {
            res.status(400).json({ message: 'Invalid OTP.' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

const cooldownPeriod = 60 * 1000; // 1 minute cooldown

async function sendOTP1(user, method = 'email') {
    const now = new Date();
    let otp = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        if (method === 'email') {
            if (user.emailOTPRequestedAt && now - user.emailOTPRequestedAt < cooldownPeriod) {
                return { success: false, message: 'Please wait before requesting another OTP.' };
            }
            user.emailOTP = otp;
            user.emailOTPRequestedAt = now;
            await user.save();
            await sendOTPViaEmail(user.email, otp); // Assuming sendOTPViaEmail is a function that sends the email OTP
        } else {
            if (user.phoneOTPRequestedAt && now - user.phoneOTPRequestedAt < cooldownPeriod) {
                return { success: false, message: 'Please wait before requesting another OTP.' };
            }
            user.phoneOTP = otp;
            user.phoneOTPRequestedAt = now;
            await user.save();
            await sendOTPViaSMS(user.phone, otp); // Assuming sendOTPViaSMS is a function that sends the SMS OTP
        }

        return { success: true, message: 'OTP sent successfully.' };
    } catch (error) {
        return res.json({ success: false, message: 'there was an error.' });
    }
    
}

async function sendOTPViaEmail(email, otp){
    try {
        sendOTP(email,`Your email verification code is ${otp}`)
    } catch (error) {
        return "There was an error: "+error.message
    }
}

async function sendOTPViaSMS(phone, otp){
    try {
        sendSMS(phone, `Your phone verification code is ${otp}`)
    } catch (error) {
        return "There was an error: "+error.message
    }
}

app.post('/send-otp', async (req, res) => {
    try {
        const { userId, method } = req.body; // 'method' can be 'email' or 'phone'
        const user = await User.findById(Types.ObjectId(userId));
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const result = await sendOTP1(user, method);
        res.json(result);
    } catch (error) {
        return res.json({ success: false, message: 'Error: '+error.message });
    }
});

app.post('/verify-otp', async (req, res) => {
    const { userId, otp, method } = req.body;
    try {
        const user = await User.findById(new Types(userId));
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    
        let isValid = false;
        if (method === 'email') {
            isValid = user.emailOTP === otp;
            if (isValid) user.emailVerified = true;
        } else {
            isValid = user.phoneOTP === otp;
            if (isValid) user.phoneVerified = true;
        }
    
        if (isValid) {
            user.emailOTP = null;
            user.phoneOTP = null;
            await user.save();
            const token = jwt.sign({ userId: user._id }, 'your_jwt_secret');
            return res.json({ success: true, token });
        } else {
            return res.json({ success: false, message: 'Invalid OTP.' });
        }
    } catch (error) {
        return res.json({ success: false, message: 'There was an error'+error.message });
    }
});

app.post('/verify-phone', async (req, res)=>{
    const { userId, phone } = req.body;
    console.log(req.body)
    try {
        const user = await User.findById(new Types(userId));

        if (!user) return res.status(404).json({ success: false, message: 'It seems you dont have an account with us.' });

        user.phone = phone;
        await sendOTP1(user, "phone")
        await user.save();
        return res.json({ success: true, message: "Wow, enter otp on your phone to complete signing up" });
    } catch (error) {
        return res.json({ success: false, message: 'There was an error, sorry its on our side' });
    }
})


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
