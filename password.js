// ================================
// SELECT ELEMENTS
// ================================

const password = document.getElementById("password");

const generateBtn = document.getElementById("generateBtn");

const copyBtn = document.getElementById("copyBtn");

const refreshBtn = document.getElementById("refreshBtn");

const slider = document.getElementById("lengthSlider");

const lengthValue = document.getElementById("lengthValue");

const uppercase = document.getElementById("uppercase");

const lowercase = document.getElementById("lowercase");

const numbers = document.getElementById("numbers");

const symbols = document.getElementById("symbols");

const strengthFill = document.getElementById("strengthFill");

const strengthLabel = document.getElementById("strengthLabel");

const toast = document.getElementById("toast");


// ================================
// CHARACTER SETS
// ================================

const upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const lowerChars = "abcdefghijklmnopqrstuvwxyz";

const numberChars = "0123456789";

const symbolChars = "!@#$%^&*()_+?><:{}[]";


// ================================
// UPDATE LENGTH
// ================================

slider.addEventListener("input", () => {

    lengthValue.textContent = slider.value;

});


// ================================
// RANDOM CHARACTER
// ================================

function randomCharacter(chars){

    return chars[Math.floor(Math.random()*chars.length)];

}


// ================================
// GENERATE PASSWORD
// ================================

function generatePassword(){

    let chars = "";

    if(uppercase.checked){

        chars += upperChars;

    }

    if(lowercase.checked){

        chars += lowerChars;

    }

    if(numbers.checked){

        chars += numberChars;

    }

    if(symbols.checked){

        chars += symbolChars;

    }

    if(chars.length===0){

        alert("Select at least one option.");

        return;

    }

    let pass="";

    for(let i=0;i<slider.value;i++){

        pass += randomCharacter(chars);

    }

    password.value = pass;

    checkStrength(pass);

}


// ================================
// PASSWORD STRENGTH
// ================================

function checkStrength(pass){

    let score = 0;

    if(pass.length>=8) score++;

    if(pass.length>=12) score++;

    if(/[A-Z]/.test(pass)) score++;

    if(/[a-z]/.test(pass)) score++;

    if(/[0-9]/.test(pass)) score++;

    if(/[!@#$%^&*()_+?><:{}[\]]/.test(pass)) score++;

    if(score<=2){

        strengthFill.style.width="25%";

        strengthFill.style.background="red";

        strengthLabel.textContent="Weak";

    }

    else if(score<=4){

        strengthFill.style.width="60%";

        strengthFill.style.background="orange";

        strengthLabel.textContent="Medium";

    }

    else{

        strengthFill.style.width="100%";

        strengthFill.style.background="limegreen";

        strengthLabel.textContent="Strong";

    }

}


// ================================
// COPY PASSWORD
// ================================

copyBtn.addEventListener("click",()=>{

    if(password.value==="") return;

    navigator.clipboard.writeText(password.value);

    toast.classList.add("show");

    setTimeout(()=>{

        toast.classList.remove("show");

    },2000);

});


// ================================
// GENERATE BUTTON
// ================================

generateBtn.addEventListener("click",generatePassword);


// ================================
// REFRESH BUTTON
// ================================

refreshBtn.addEventListener("click",generatePassword);


// ================================
// GENERATE ON PAGE LOAD
// ================================

generatePassword();