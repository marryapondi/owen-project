$(document).ready(function () {
    loadCurrentStep();
});
    const steps = {
        registration: showRegistrationForm,
        login: showLoginForm,
        emailVerification: showOTPConfirmationForm,
        phoneVerification: showPhoneNumberVerificationForm,
    };


    function loadCurrentStep() {
        const currentStep = sessionStorage.getItem('currentStep') || 'registration';
        steps[currentStep]();
    }

    function updateFormContainer(content) {
        $('#form-container').html(content);
    }

    function updateCurrentStep(step) {
        sessionStorage.setItem('currentStep', step);
    }

    function showRegistrationForm() {
        updateFormContainer(`
            <h6>Sign up</h6>
            <div>
                <span>Have an account?</span>
                <small><a href="#" id="login-link">Login</a></small>
            </div>
            <div class="inputs1 d-flex flex-column justify-content-center mt-2">
                ${generateInputFields([
                    { label: 'Surname', id: 'surname', type: 'text', required: true },
                    { label: 'First Name', id: 'first_name', type: 'text', required: true },
                    { label: 'Other Name', id: 'other_name', type: 'text' },
                    { label: 'Username', id: 'username', type: 'text' },
                    { label: 'Email', id: 'email', type: 'email', required: true },
                    { label: 'Phone', id: 'phone', type: 'text', required: true },
                    { label: 'Password', id: 'password', type: 'password', required: true },
                ])}
            </div>
            <div class="mt-4">
                <button class="btn btn-danger px-4" id="signup-btn">Sign up</button>
            </div>
        `);
        updateCurrentStep('registration');
    }

    function showLoginForm() {
        updateFormContainer(`
            <h6>Login</h6>
            <div>
                <span>Don't have an account?</span>
                <small><a href="#" id="signup-link">Sign up</a></small>
            </div>
            <div class="inputs1 d-flex flex-column justify-content-center mt-2">
                ${generateInputFields([
                    { label: 'Username or Email', id: 'username-l', type: 'text' },
                    { label: 'Password', id: 'password-l', type: 'password' },
                ])}
            </div>
            <div class="mt-4">
                <button class="btn btn-danger px-4" id="login-btn">Login</button>
            </div>
        `);
        updateCurrentStep('login');
    }

    function showOTPConfirmationForm(method="email") {
        updateFormContainer(`
            <h6>Please enter the code sent <br> to your ${method}.</h6>
            <div> <span>A code has been sent to</span> <small id="email-v">*******0000</small>. </div>
            <div id="otp" class="inputs d-flex flex-row justify-content-center mt-2">
                ${generateOTPInputs(6)}
            </div>
            <div class="mt-4">
                <button class="btn btn-danger px-4" id="validate-otp-btn" onclick="handleOTPConfirmation('${method}')">Validate</button>
            </div>
        `);
        updateCurrentStep('emailVerification');
        OTPInput();
    }

    function showPhoneNumberVerificationForm() {
        updateFormContainer(`
            <h6>Add and Verify Your Phone Number</h6>
            <div class="inputs1 d-flex flex-column justify-content-center mt-2">
                ${generateInputFields([{ label: 'Phone Number', id: 'phone', type: 'text', required: true }])}
            </div>
            <div class="mt-4">
                <button class="btn btn-danger px-4" id="send-verification-code-btn">Send Verification Code</button>
            </div>
        `);
        updateCurrentStep('phoneVerification');
    }

    function handleRegistration() {
        let data = getInputValues(['surname', 'first_name', 'other_name', 'username', 'email', 'phone', 'password']);

        data.phone = formatPhoneNumber(data.phone);
        
        if (!data.surname || !data.first_name || !data.username || !data.email || !data.password) {
            return customAlert("Please fill in all fields");
        }
        console.log(data.phone)

        console.log(data)

        processRequest('/register', data, (res) => {
            if (res.success) {
                sessionStorage.setItem('userId', res.userId);
                // showOTPForm("email");
                showOTPConfirmationForm("email");
            } else {
                customAlert(res.message);
            }
        });
    }

    function resolveDialogPromise(result){
        hideCustomDialog();
        return result;
    }

    function handleLogin() {
        const data = getInputValues(['username-l', 'password-l']);

        if (!data['username-l'] || !data['password-l']) {
            return customAlert("Please fill in all fields");
        }

        processRequest('/login', data, (res) => {
            if (res.message === "Second authentication OTP sent. Please verify.") {
                sessionStorage.setItem('userId', res.userId);
                showSecondAuthForm();
            } else {
                customAlert(res.message);
            }
        });
    }

    function handleOTPConfirmation(method,login=false) {
        const otp = getOTPValues();

        if (otp.length !== 6) {
            return customAlert("Please enter the full 6-digit OTP.");
        }

        const data = { userId: sessionStorage.getItem('userId'), otp, method };
        processRequest('/verify-otp', data, (res) => {
            if (res.success) {
                customAlert('OTP validated! Proceeding to next step...');
                if(method == "email"){
                    showPhoneNumberVerificationForm();
                }else{
                    if(login){
                        window.location.href = '/'
                    }else{
                        showLoginForm();
                        customAlert("You can now login");
                    }
                }
            } else {
                customAlert(res.message);
            }
        });
    }

    async function handlePhoneVerification() {
        let phone = await getInputValues(['phone']);
        phone = `${phone.phone}`

        if (!phone) {
            return customAlert("Please enter your phone number.");
        }
        phone = formatPhoneNumber(`${phone}`);
        console.log(phone)
        const data = {
            phone: phone,
            userId: sessionStorage.getItem('userId')
        }
        if(phone.length < 12){
            console.log(phone.length)
            return customAlert("Hey it seems your number is missing some digits");
        }else if(data.phone.length > 12){
            return customAlert("Hey it seems your number has more digits");
        }

        // data['userId'] = sessionStorage.getItem('userId');
        processRequest('/verify-phone', data, (res) => {
            if (res.success) {
                showOTPConfirmationForm("phone");
            } else {
                customAlert(res.message);
            }
        });
    }

    function processRequest(url, data, callback) {
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text) });
            }
            return response.json();
        })
        .then(callback)
        .catch(error => customAlert(error.message))
        // .finally(hideCustomDialog);
    }
    

    function getInputValues(ids) {
        return ids.reduce((acc, id) => {
            acc[id] = $(`#${id}`).val();
            return acc;
        }, {});
    }

    function getOTPValues() {
        return $('#otp input').map(function () { return $(this).val(); }).get().join('');
    }

    function generateInputFields(fields) {
        return fields.map(field => `
            <label for="${field.id}">${field.label}:</label>
            <input class="m-2 form-control rounded" type="${field.type}" id="${field.id}" ${field.required ? 'required' : ''} />
        `).join('');
    }

    function generateOTPInputs(length) {
        return Array.from({ length }, (_, i) => `
            <input class="m-2 text-center form-control rounded" type="text" id="otp${i + 1}" maxlength="1" />
        `).join('');
    }

    function customAlert(textB, textH = "Alert!", showSpinner = false) {
        $('#textH').text(textH);
        $('#textB').html(showSpinner ? `<div class="d-flex align-items-center"><div class="spinner-border mr-2"></div>${textB}</div>` : textB);
        $('#btnAcc').toggle(!showSpinner);
        $('#custom-dialog-box').modal('show');
    }
    function hideCustomDialog() {
        $('#custom-dialog-box').modal('hide');
    }

    function OTPInput() {
        $('#otp input').on('keyup', function (e) {
            if (e.keyCode === 8 && $(this).prev('input').length) {
                $(this).prev('input').focus();
            } else if ($(this).val() && $(this).next('input').length) {
                $(this).next('input').focus();
            }
        });
    }

    // Event Listeners
    $('#form-container').on('click', '#login-link', showLoginForm);
    $('#form-container').on('click', '#signup-link', showRegistrationForm);
    $('#form-container').on('click', '#signup-btn', handleRegistration);
    $('#form-container').on('click', '#login-btn', handleLogin);
    // $('#form-container').on('click', '#validate-otp-btn', handleOTPConfirmation);
    $('#form-container').on('click', '#send-verification-code-btn', handlePhoneVerification);

    function formatPhoneNumber(phone) {
        console.log(phone)
        // Remove any non-digit characters
        let cleanedPhone = phone.replace(/\D/g, '');
    
        // If the phone number starts with '0', replace it with '256'
        if (cleanedPhone.startsWith('0')) {
            cleanedPhone = '256' + cleanedPhone.substring(1);
        }
    
        // If the phone number starts with '+', remove the '+'
        if (cleanedPhone.startsWith('+')) {
            cleanedPhone = cleanedPhone.substring(1);
        }
    
        // Ensure the phone number starts with '256' (for Uganda)
        if (!cleanedPhone.startsWith('256')) {
            customAlert("Make sure you are using a ugandan number, eg. 2567XXXXXXXXX, the number should be 12 digits")
        }
    
        return cleanedPhone;
    }
    