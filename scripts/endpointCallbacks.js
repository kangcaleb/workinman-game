

const login = (req, res) => {
  const username = req.body.email;
  const password = req.body.password;

  client.query(`select pass from Users where Users.username='${username}' limit 1`, (err, result) => {
    if (err) {
        res.status(500).send('Error in getting user')
    } else {
        const passwords = result.rows

        if (passwords) {
            if (passwords.length == 0) {
                res.status(400).send('No Username found'); return
            }
            if (passwords[0].password === password) {
                req.session.user = {'username': username, 'pass': password}
                res.json(username)
            } else {
                res.status(401).send('Credentials Invalid')
            }
        } else {
            res.status(500).send('Error in getting user')
        }
    }
})
}

const getUser = (req, res) => {
    const user = req.session.user
    res.json(user)
}

const logout = (req, res) => {
    delete req.session.user
    res.send(true)
}

const deleteUser = (req, res) => {
    const username = req.body.email;
    const password = req.body.password;

    const currentUser = req.session.user

    if (!currentUser) {
        res.status(500).send("Server Error while Deleting User"); return;
    }

    if (username === currentUser.username && password === currentUser.password) {
        client.query(`delete from Users where Users.username='${username}'`, (err, result) => {
            if (err) {
                res.status(500).send('Server error while deleting user')
            } else {
                res.status(200).send(true)
            }
        })
    } else {
        res.status(401).send("Credentials Invalid. Did not delete")
    }
}

const createUser = (req, res) => {
    const name = req.body.email
    const password = req.body.password

    if (name == null || password == null) {
        res.status(400).send('Need Username and password')
        return
    }

    client.query(`INSERT INTO USERS VALUES('${name}', '${password}')`, (err, result) => {
        if (err) {
            res.status(400).send(err)
        } else {
            // also need to do some aws work too 
            res.send(result)
        }
    })
}
