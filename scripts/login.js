const submitButtonClicked = (ev) => {
    const toggle = document.getElementById("toggle")

    if (toggle.innerText === "Not new? Login") {

        const password = document.getElementById('pass').value
        const passRepeat = document.getElementById('pass-repeat').value

        if (passRepeat !== password) {
            alert("passwords do not match"); return;
        }

        const data = {
            "username": document.getElementById('username').value,
            "password": password
        }
        
        fetch(location.origin+'/user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        }).then(response => response.json())
        .then(response => {
            alert('account created')
        }).catch(err => {
            alert(err)
        })

    } else {

        const data = {
            "username": document.getElementById('username').value,
            "password": document.getElementById('pass').value
        }
        
        fetch(location.origin+'/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        }).then((response) => response.json())
          .then((response) => {
            setTimeout(function () {
                window.location.href = response.path;
            }, 2000)
        }).catch(err => alert(err))
    }
}

const submitButton = document.getElementById("userSubmit");
submitButton.onclick = submitButtonClicked

const toggle = (ev) => {
    const toggle = document.getElementById("toggle")
    const passRepeat = document.getElementById("pass-repeat")

    if (toggle.innerText === "New? Create User") {
        passRepeat.hidden = false;

        toggle.innerText = "Not new? Login"
    } else {
        passRepeat.hidden = true;
        toggle.innerText = "New? Create User"
    }
}
document.getElementById("toggle").onclick = toggle