

const init = async () => {
    const user = await fetch(location.origin+'/user', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }).then(response => response.json())

    if (!user) {
        // do nothing
    } else {
        const root = document.getElementById('root');
        root.innerHTML = 
        `<div id=header> 
            <h1>Your Dashboard</h1>
            <div id="accountActions">
            <h2>Account</h2>
            <div id="logout"> 
                <button id="logoutButton">Logout</button>
            </div>
            <div id="delete">
              <h3>Delete Account</h3>
              <input id="username" type="text" placeholder="Username">
              <input id="password" type="password" placeholder="password">
              <input id="checkbox" type="checkbox">
              <label for="checkbox">Yes, Delete</label>
              <button id="deleteButton" onclick="deleteAccount()">Delete</button>
            </div>
          </div>
            
        </div>
        
        <div id="uploads">
          <div id="csv-upload">
              <h3>Upload CSV</h3>
              <p>Format: Question Id,Question,Correct Answer,Wrong Answer 1,Wrong Answer 2,Wrong Answer 3,Difficulty Level,Image Name</p>
              <p>Don't include Header in file, but CSV will be parsed according to this format</p>
              <form id="csv-form" encType="multipart/form-data" action="/uploadCsv" method='POST'>
                  <input type="file" name="csvUpload" accept=".csv">
                  <button type="submit">Upload CSV</button>
              </form>
          </div>
          <div id="img-upload">
              <h3>Upload Image</h3>
              <form id="img-form" encType="multipart/form-data" action="/uploadImg" method='POST'>
                  <input type="file" name="imageUpload" accept="image/*">
                  <button type="submit">Upload Img</button>
              </form>
          </div>
        </div>`

        await displayImages(user)
        await displayQuestions(user)
        dispayLogout()
    }
}

const displayQuestions = async (user) => {
    const result = await fetch(location.origin+'/questions', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }).then(response => response.json())

    const questions = result.questions
    if (questions.length == 0) {
        return;
    } else {

        const root = document.getElementById('root');
        root.innerHTML = root.innerHTML + 
        `<div id="questions">
            <table id="questions-table">
                <tr>
                    <th>Question</th>
                    <th>A1</th>
                    <th>A2</th>
                    <th>A3</th>
                    <th>A4</th>
                    <th>Difficulty</th>
                </tr>
            </table>
         </div>`

         const questionsTable = document.getElementById('questions-table');
         const username = user.username;

         questions.forEach(question => {
            questionsTable.innerHTML += 
            `<tr>
                <td>${question[1]}</th>
                <td>${question[2]}</th>
                <td>${question[3]}</th>
                <td>${question[4]}</th>
                <td>${question[5]}</th>
            </tr>`
         })
         

    }
}

const displayImages = async (user) => {
    const result = await fetch(location.origin+'/images', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }).then(response => response.json())


    if (result.contentsArray.length == 0) {
        return;
    } else {
        const root = document.getElementById('root');

        root.innerHTML = root.innerHTML + 
        `<div id="images">
            <ul id="image-list">

            </ul>
        </div>`

        const imageList = document.getElementById('image-list');
        const username = user.username;

        result.contentsArray.forEach(imgData => {
            const imgName = imgData.Key
            imageList.innerHTML = imageList.innerHTML + `<li><img src="https://${username}-img.s3.amazonaws.com/${imgName}"></li>`
        })
    }
}

const logoutButtonClicked = (ev) => {
    fetch(location.origin+'/logout', {
        method: 'POST'
    }).then(response => {
        alert("logged out")
        window.location.href = '/';
    })
}

const dispayLogout = () => {
    const logOutButton = document.getElementById('logoutButton')
    logOutButton.onclick = logoutButtonClicked
}

const deleteAccount = () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const isChecked = document.getElementById('checkbox').checked;

    if (isChecked && username && password && username.length !=0 && password.length !=0) {
        fetch(location.origin+'/user', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                "username": username,
                "password": password
            })
        }).then(result => result.json())
          .then(response => {
            if (response.code == 200) {
                alert("Delete Success"); window.location.href = '/'
            } else {
                alert(err)
            }
            
        }).catch(err => alert(err))
    } else {
        return alert("Fill all requirements to delete")
    }
}

init()