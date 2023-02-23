const express = require('express')
const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(__dirname));

const fileUpload = require('express-fileupload');
app.use(fileUpload())

const bodyParser = require('body-parser')
app.use(bodyParser.json())

const Papa = require('papaparse');

const expressSession = require('express-session')
app.use(expressSession({
    name: 'workinman-cookie',
    resave: false,
    saveUninitialized: false,
    secret: "w0rkin",
    cookie: {secure: false}
}))

const path = require('path')


/**
 * 
 * PG Client and Connect
 */
const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://gifplmcbylcauk:0f72a8944cdd72f68356bb592b060f414981ff0128c1ab3b9a8aed8ee5a97d6c@ec2-35-168-194-15.compute-1.amazonaws.com:5432/d1715hvjr80f3g', //process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
client.connect();

/**
 * 
 * 
 * AWS Client and Connect
 */
var AWS = require("aws-sdk");
var s3 = new AWS.S3({
    apiVersion: '2006-03-01', region:"us-east-1"
});


const login = (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
  
    client.query(`select pass from Users where Users.username='${username}' limit 1`, (err, result) => {
      if (err) {
          return res.status(500).send('Error in getting user')
      } else {
          const passwords = result.rows
  
          if (passwords) {
              if (passwords.length == 0) {
                  return res.status(400).send('No Username found');
              }
              if (passwords[0].pass === password) {
                  req.session.user = {'username': username, 'pass': password}
                  return res.json({"path": "../views/dashboard.html"})
              } else {
                  return res.status(401).send('Credentials Invalid')
              }
          } else {
              return res.status(500).send('Error in getting user')
          }
      }
  })
  }
  
const getUser = (req, res) => {
      const user = req.session.user
      return user;
}

const getUserEndpoint = (req, res) => {
    const user = getUser(req, res)
    return res.json(user)
}
  
const logout = (req, res) => {
      delete req.session.user
      return res.sendFile(path.join(__dirname, '/views/index.html'))
}

// Would be nice to delete buckets after deleting user, but no time
const deleteUser = (req, res) => {
      const username = req.body.username;
      const password = req.body.password;
  
      const currentUser = req.session.user
  
      if (!currentUser) {
        res.status(500).json({"code": 500, "msg": "Server Error"}); return;
      }
  
      if (username === currentUser.username && password === currentUser.pass) {
          client.query(`delete from Users where Users.username='${username}'`, (err, _) => {
              if (err) {
                res.status(500).json({"code": 500, "msg": "Server Error"})
              } else {
                const imgParam = {Bucket: `${username}-img`}
                s3.deleteBucket(imgParam, (err, _) => {
                    if (err) {
                        res.status(500).json({"code": 500, "msg": "Server Error"})
                    } else {
                        const csvParams = {Bucket: `${username}-csv`}
                        s3.deleteBucket(csvParams, (err, data) => {
                            if (err) {
                                res.status(500).json({"code": 500, "msg": "Server Error"})
                            } else {
                                res.status(200).json({"code": 200, "msg": "Delete Success"})
                            }
                        })
                    }
                })
              }
          })
      } else {
          return res.status(401).json({"code": 401, "msg": "Credentials Invalid. Did not delete"})
      }
}

const deleteUserAfterFailCreate = (username) => {
    client.query(`delete from Users where username=${username};`, (err, result) => {
        if (err) throw err
    })
}
  
const createUser = (req, res) => {
      const name = req.body.username
      const password = req.body.password
  
      if (name == null || password == null) {
          res.status(400).send('Need Username and password')
          return
      }
  
      client.query(`INSERT INTO USERS (username, pass) VALUES('${name}', '${password}')`, (err, _) => {
          if (err) {
              console.log(err)
              res.status(400).send("error in creating new user")
          } else {

            // Create csv bucket for user
            s3.createBucket({Bucket: `${name}-csv`}, (err, _) => {
                if (err) {
                    res.status(500).send("Error in creating AWS csv bucket")
                    deleteUserAfterFailCreate(name)
                } else {
                    // Create img bucket for user
                    s3.createBucket({Bucket: `${name}-img`}, (awserr, _) => {
                        if (awserr) {
                            deleteUserAfterFailCreate(name)
                            res.status(500).send("Error in creating AWS IMAGE bucket")
                        } else { 
                            // successfully created 2 buckets and user in postres
                            res.status(200).json({"username": name})
                        }
                    })
                }
            })
          }
      })
}


/**
 * 
 * AWS s3 Upload Operations
 */
const uploadCSV = (req, res) => {
    const user = getUser(req, res)
    if (!user) {
        return
    }

    const csv = req.files.csvUpload.data;
    const name = req.files.csvUpload.name;
    const username = user.username
    const params = {Bucket: `${username}-csv`, Key: name, Body: csv, ACL: "public-read"}

    s3.upload(params, (err, _) => {
        if (err) {
            res.status(500)
        } else {
            return res.sendFile(path.join(__dirname, '/views/dashboard.html'))
        }
    })
}

const uploadImg = (req, res) => {
    const user = getUser(req, res)
    if (!user) {
        return
    }

    const img = req.files.imageUpload.data;
    const username = user.username
    const key = req.files.imageUpload.name

    const params = {Bucket: `${username}-img`, Key: key, Body: img, ACL: "public-read"}

    s3.upload(params, (err, data) => {
        if (err) {
            res.status(500).send("Error Uploading Image")
        } else {
            return res.sendFile(path.join(__dirname, '/views/dashboard.html'))
        }
    })
}


/**
 * 
 * 
 * AWS GET operations
 */

const getAllCsv = async (req, res) => {
    const user = getUser(req, res)
    if (!user) {
        return
    }

    const username = user.username
    const params = { 
        Bucket: `${username}-csv`,
        Delimiter: '/'
    }

    try {
        const list = []
        const data = await s3.listObjectsV2(params).promise();

        for (let i=0; i<data.Contents.length; i++) {
            const contentObj = data.Contents[i]
            const key = contentObj.Key
            const csvFile = await s3.getObject({Bucket: `${username}-csv`, Key: key}).promise();
            const stringBody = csvFile.Body.toString();
            const parsed = Papa.parse(stringBody, {header: false}) // array here

            parsed.data.forEach(question => {
                list.push(question)
            });
        }

        res.json({"questions": list})
    } catch (err) {
        console.log(err)
        res.status(500).send("Error getting files")
    }
       
    // s3.listObjects(params, function (err, data) {
    //     if(err)throw err;
        
    //     data.Contents.forEach(contentObj => {
    //         const key = contentObj.Key;

    //     })
    //    }
    // );   
}

const getImages = (req, res) => {
    const user = getUser(req, res)
    if (!user) {
        return
    }

    const username = user.username

    const params = { 
        Bucket: `${username}-img`
       }
       
    s3.listObjectsV2(params, function (err, data) {
        if(err)throw err;
        return res.json({"username": username, "contentsArray": data.Contents});
    });   
}

/**
 * 
 * 
 * Here are the Account endpoints: Login, get User, log out, delete account, create user
 */
app.post('/login', login);
app.get('/user', getUserEndpoint);
app.post('/logout', logout);
app.delete('/user', deleteUser);
app.post('/user', createUser);
app.post('/uploadCsv', uploadCSV);
app.post('/uploadImg', uploadImg)

app.get('/images', getImages)
app.get('/questions', getAllCsv)


/**
 * 
 * Init App
 */
app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '/views/index.html'))
})
app.listen(3001, () => {
    console.log("Listening on port 3001!")
})