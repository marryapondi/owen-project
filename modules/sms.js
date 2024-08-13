const con = require("../config.json");

/**
 * Function to connect to the Egosms API to send SMS.
 * @param {string} number - The phone number to receive the SMS. For example '256xxxxxxxxx'.
 * @param {string} message - The message to be sent to the receiving number. For example 'Hello'.
 * @returns {Promise<Object>} - A promise that resolves to the response body.
 */
async function sendSMS(number, message) {
    const url = con.egosms.url;
    const data = JSON.stringify({
        method: 'SendSms',
        userdata: {
            username: con.egosms.username,
            password: con.egosms.password
        },
        msgdata: [{
            message: message,
            number: number,
            senderid: 'Trial'
        }]
    });

    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data
    };

    try {
        const res = await fetch(url, options);
        const responseBody = await res.text();

        if (!res.ok) {
            return {
                sent: false,
                data: responseBody
            };
        } else {
            return {
                sent: true,
                data: responseBody
            };
        }
    } catch (error) {
        return {
            sent: false,
            data: error.message
        };
    }
}

async function checkBalance(){
    const data = JSON.stringify({
        "method":"Balance",
        "userdata":{
           "username":con.egosms.username,
           "password":con.egosms.password
        }
     });

     const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data
    };

    try {
        const res = await fetch(con.egosms.url, options);
        const responseBody = await res.text();
        console.log(responseBody)

        if (!res.ok) {
            return {
                sent: false,
                data: responseBody
            };
        } else {
            return {
                sent: true,
                data: responseBody
            };
        }
    } catch (error) {
        return {
            sent: false,
            data: error.message
        };
    }
}

module.exports = {
    sendSMS,
    checkBalance
};
