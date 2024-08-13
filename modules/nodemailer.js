const nodemailer = require("nodemailer");
const con = require("../config.json");

const transporter = nodemailer.createTransport({
    service: 'Yandex',
    auth: { 
        user: con.nodemailer.user, 
        pass: con.nodemailer.password
    }
});

/**
 * Function to send an email with OTP.
 * @param {string} email - The email to receive the message, e.g., "myemail@gmail.com".
 * @param {string} message - The message to be sent, e.g., "hello".
 * @returns {Promise<Object>}
 */
async function sendOTP(email, message) {
    const mailOptions = {
        from: 'Kita<kabakamulwa@yandex.com>',
        to: email,
        subject: 'Alex Security',
        text: message
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Message sent: " + info.response);
        return {
            success: true,
            response: info.response
        };
    } catch (error) {
        console.error("Error sending email: ", error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    sendOTP
};
