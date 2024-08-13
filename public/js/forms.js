// Utility to show form content
function showForm(content) {
    document.getElementById('app').innerHTML = content;
}
  
  // Step 1: Registration Form
function showRegistrationForm() {
    const formHTML = `
        <h6>Sign up</h6>
        <div>Have an account? <small><a href="#" onclick="showLoginForm()">Login</a></small></div>
        <div class="inputs1 d-flex flex-column justify-content-center mt-2">
        <label for="surname">Surname:</label>
        <input class="m-2 form-control rounded" type="text" id="surname" required />
        <label for="first_name">First Name:</label>
        <input class="m-2 form-control rounded" type="text" id="first_name" required />
        <label for="other_name">Other Name:</label>
        <input class="m-2 form-control rounded" type="text" id="other_name" />
        <label for="username">Username:</label>
        <input class="m-2 form-control rounded" type="text" id="username" required />
        <label for="email">Email:</label>
        <input class="m-2 form-control rounded" type="email" id="email" required />
        </div>
        <div class="mt-4">
        <button class="btn btn-danger px-4" onclick="handleRegistration()">Sign up</button>
        </div>`;
    showForm(formHTML);
}
  
// Step 2: Handle Registration
function handleRegistration() {
    const userData = {
        surname: document.getElementById('surname').value,
        firstName: document.getElementById('first_name').value,
        otherName: document.getElementById('other_name').value,
        username: document.getElementById('username').value,
        email: document.getElementById('email').value
    };
    for(i of userData){
        console.log(i)
    }
    // Store data temporarily in session storage
    sessionStorage.setItem('userData', JSON.stringify(userData));

    // Send OTP to user's email (Assume function exists on the backend to send OTP)
    fetch('/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userData.email })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
        showOTPConfirmationForm();
        } else {
        customAlert('Failed to send OTP. Please try again.');
        }
    });
}
  
  // Step 3: OTP Confirmation Form
function showOTPConfirmationForm(otp="email") {
    const formHTML = `
        <h6>Please enter the code sent to your ${otp}.</h6>
        <div>A code has been sent to your email.</div>
        <div id="otp" class="inputs d-flex flex-row justify-content-center mt-2">
        <input class="m-2 text-center form-control rounded" type="text" id="otp1" maxlength="1" />
        <input class="m-2 text-center form-control rounded" type="text" id="otp2" maxlength="1" />
        <input class="m-2 text-center form-control rounded" type="text" id="otp3" maxlength="1" />
        <input class="m-2 text-center form-control rounded" type="text" id="otp4" maxlength="1" />
        <input class="m-2 text-center form-control rounded" type="text" id="otp5" maxlength="1" />
        <input class="m-2 text-center form-control rounded" type="text" id="otp6" maxlength="1" />
        </div>
        <div class="mt-4">
        <button class="btn btn-danger px-4" onclick="handleOTPConfirmation(${otp})">Validate</button>
        </div>`;
    showForm(formHTML);
}
  
// Step 4: Handle OTP Confirmation
function handleOTPConfirmation() {
    const otp = [
        document.getElementById('otp1').value,
        document.getElementById('otp2').value,
        document.getElementById('otp3').value,
        document.getElementById('otp4').value,
        document.getElementById('otp5').value,
        document.getElementById('otp6').value
    ].join('');

    fetch('/validate-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
        // Registration complete, send data to server
        const userData = JSON.parse(sessionStorage.getItem('userData'));
        fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        })
        .then(response => response.json())
        .then(data => {
            hideCustomDialog();
            if (data.success) {
            customAlert('Registration successful!');
            sessionStorage.removeItem('userData');
            showLoginForm();
            } else {
            customAlert('Registration failed. Please try again.');
            }
        });
        } else {
        customAlert('Invalid OTP. Please try again.');
        }
    });
}
  
// Step 5: Login Form
function showLoginForm() {
    const formHTML = `
        <h6>Login</h6>
        <div>Don't have an account? <small><a href="#" onclick="showRegistrationForm()">Sign up</a></small></div>
        <div class="inputs1 d-flex flex-column justify-content-center mt-2">
        <label for="username">Username or Email:</label>
        <input class="m-2 form-control rounded" type="text" id="username-l" required />
        <label for="password">Password:</label>
        <input class="m-2 form-control rounded" type="password" id="password-l" required />
        </div>
        <div class="mt-4">
        <button class="btn btn-danger px-4" onclick="handleLogin()">Login</button>
        </div>`;
    showForm(formHTML);
}
  
// Step 6: Handle Login
function handleLogin() {
    const loginData = {
        username: document.getElementById('username-l').value,
        password: document.getElementById('password-l').value
    };
    customAlert('Verifying details...', 'Please wait', true); 
    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
    })
    .then(response => response.json())
    .then(data => {
        hideCustomDialog();
        if (data.success) {
            // Store the JWT in local storage
            localStorage.setItem('token', data.token);
            customAlert('Login successful!', 'Success');
            // Redirect to a protected page or show protected content
        } else {
            customAlert('Login failed. Please check your credentials.');
        }
    });
}
  
// Initialize the registration form on page load
document.addEventListener('DOMContentLoaded', showRegistrationForm);
// Step 7: Phone Number Verification Form
function showPhoneNumberVerificationForm() {
    const formHTML = `
        <h6>Add and Verify Your Phone Number</h6>
        <div class="inputs1 d-flex flex-column justify-content-center mt-2">
        <label for="phone">Phone Number:</label>
        <input class="m-2 form-control rounded" type="text" id="phone" required />
        </div>
        <div class="mt-4">
        <button class="btn btn-danger px-4" onclick="handlePhoneVerification()">Send Verification Code</button>
        </div>`;
    showForm(formHTML);
}
  
// Step 8: Handle Phone Number Verification
function handlePhoneVerification() {
    const phone = document.getElementById('phone').value;

    // Start loading spinner
    customAlert('Sending verification code...', 'Please wait', true); // true enables the spinner

    fetch('/send-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
    })
    .then(response => response.json())
    .then(data => {
        // Stop loading spinner
        hideCustomDialog();

        if (data.success) {
        // Store the phone number temporarily
        customAlert('Code has been sent.');
        sessionStorage.setItem('phone', phone);
        showOTPConfirmationForm(); // Reuse the OTP confirmation form for phone OTP
        } else {
        customAlert('Failed to send verification code. Please try again.');
        }
    })
    .catch(() => {
        // Stop loading spinner and show error
        hideCustomDialog();
        customAlert('Network error. Please try again.');
    });
}
    