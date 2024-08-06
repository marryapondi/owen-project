// mongoose.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 10;

// Connect to the MongoDB database
mongoose.connect('mongodb+srv://kitaroghope:kitasrog@cluster0.9uort.mongodb.net/userVer?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const userSchema = new mongoose.Schema({
    surname: {type: String, required: true},
    last_name: {type: String, required: true},
    other_name: {type: String, required: false},
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String, unique: true, required: true },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    emailOTP: { type: String },
    phoneOTP: { type: String },
});

// Pre-save hook to hash the password
userSchema.pre('save', function(next) {
    if (!this.isModified('password')) return next();

    bcrypt.hash(this.password, saltRounds, (err, hash) => {
        if (err) return next(err);
        this.password = hash;
        next();
    });
});

userSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = { mongoose, User };