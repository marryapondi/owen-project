const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { User, Types } = require('./modules/mongoose');
const { sendOTP } = require('./modules/nodemailer');
const { sendSMS } = require('./modules/sms');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());
app.use(cookieParser()); // Add cookie-parser middleware
app.use(express.static(path.join(__dirname, 'public')));

// Your verifyJWT middleware and routes here

const verifyJWT = (req, res, next) => {
    const token = req.cookies.token; // Get JWT from the 'token' cookie

    if (!token) {
        // No token provided, redirect to login
        return res.redirect(`/?redirect=${encodeURIComponent(req.originalUrl)}`);
    }

    jwt.verify(token, 'secretKey', (err, decoded) => {
        if (err) {
            // Invalid token, redirect to login
            return res.redirect(`/login.html?redirect=${encodeURIComponent(req.originalUrl)}`);
        }

        // Token is valid, store user information in request
        req.user = decoded;
        next();
    });
};

// Protect the /private folder
app.use('/private', verifyJWT, express.static(path.join(__dirname, 'private')));


//redirect
app.get("/redirect", (req, res)=>{
    res.redirect("/private");
});

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
            return res.status(200).json({ message: 'Please verify your email and phone number before logging in.', 
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

            res.cookie('token', token, {
                httpOnly: true,  
                secure: true,    
                sameSite: 'Strict', 
                maxAge: 3600000  
            });

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
        return res.json({ success: true, 
            message: "Wow, enter otp on your phone to complete signing up" ,
            auth: user.phone
        });
    } catch (error) {
        return res.json({ success: false, message: 'There was an error, sorry its on our side' });
    }
})

app.get('/logout', (req, res) => {
    // Clear the JWT token cookie
    res.cookie('token', '', {
        httpOnly: true,
        secure: true,    // Ensure this is set to true if you're using HTTPS
        sameSite: 'Strict',
        expires: new Date(0) // Setting the cookie's expiry date to the past
    });
    res.redirect('/')
    // Redirect to login or home page
    // res.status(200).json({ success: true, message: 'Logged out successfully.' });
});


// const members = [
//     {
//       "Surname": "Kitamirike",
//       "last_name": "Rogers",
//       "Contact": "256757035774"
//     },
//     {
//       "Surname": "Enid",
//       "last_name": "Ngobi",
//       "Contact": "256782939628"
//     },
//     {
//       "Surname": "Kahuju",
//       "last_name": "Uzziah",
//       "Contact": "256753759488"
//     },
//     {
//       "Surname": "Tusiime",
//       "last_name": "Magret",
//       "Contact": "256750632071"
//     },
//     {
//       "Surname": "Apondi",
//       "last_name": "Gorrey",
//       "Contact": "256782422362"
//     },
//     {
//       "Surname": "Nabakooza",
//       "last_name": "Jane",
//       "Contact": "256753894213"
//     },
//     {
//       "Surname": "Kaweesi",
//       "last_name": "Jonathan",
//       "Contact": "256757037463"
//     },
//     {
//       "Surname": "Tamale",
//       "last_name": "Isaac",
//       "Contact": "256755518757"
//     },
//     {
//       "Surname": "Kenyunyuzi",
//       "last_name": "Florence",
//       "Contact": "256709628226"
//     },
//     {
//       "Surname": "Ssentongo",
//       "last_name": "Allan",
//       "Contact": "256709360910"
//     },
//     {
//       "Surname": "Mudama",
//       "last_name": "Obadiah",
//       "Contact": "256754298207"
//     },
//     {
//       "Surname": "Bwanika",
//       "last_name": "Wilson",
//       "Contact": "256751622006"
//     },
//     {
//       "Surname": "Wasswa",
//       "last_name": "Dennis",
//       "Contact": "256767276417"
//     },
//     {
//       "Surname": "Bagenda",
//       "last_name": "January",
//       "Contact": "256713082823"
//     },
//     {
//       "Surname": "Kagongoya",
//       "last_name": "Best",
//       "Contact": "256704512015"
//     },
//     {
//       "Surname": "Arora",
//       "last_name": "Richard",
//       "Contact": "256755943600"
//     },
//     {
//       "Surname": "Suzan",
//       "last_name": "Bagenda",
//       "Contact": "256753942072"
//     },
//     {
//       "Surname": "Mbabaali",
//       "last_name": "Joseph",
//       "Contact": "256782680222"
//     },
//     {
//       "Surname": "Kanamwanje",
//       "last_name": "Daniel",
//       "Contact": "256758352229"
//     }
//   ]

// async function msend(){
//     for(i = 0; i < members.length; i++){
//         const message = `Dear ${members[i].last_name}, thank you for attending last church board. Next board meeting is on 13th Oct, 2024.`;
//         const success = await sendSMS(members[i].Contact,message);
//         console.log(success.data);
//     }
// }

// msend();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
