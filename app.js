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
  connectionString: process.env.DATABASE_URL,
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
                  return res.status(400).send({"code":400, "msg": 'No Username found'});
              }
              if (passwords[0].pass === password) {
                  req.session.user = {'username': username, 'pass': password}
                  return res.json({"path": "/dashboard"})
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
                
                deleteBuckets(username)
                .then(response => {
                    return  res.status(200).json({"code": 200, "msg": "success"})
                }).catch(err => {
                    return  res.status(401).json({"code": 500, "msg": "Server error did not delete"})
                })
              }
          })
      } else {
          return res.status(401).json({"code": 401, "msg": "Credentials Invalid. Did not delete"})
      }
}

const deleteBuckets = async (username) => {
    const imgParam = {Bucket: `${username}-img`}
    const images = await s3.listObjectsV2(imgParam).promise()

    if (images.Contents.length > 0) {
        const imgKeys = images.Contents.map(({Key}) => ({Key}));
        imgParam.Delete = {
            Objects: imgKeys
        }

        await s3.deleteObjects(imgParam).promise()
    }

    const csvParam = {Bucket: `${username}-csv`}
    const csvs = await s3.listObjectsV2(csvParam).promise()

    if (csvs.Contents.length > 0) {
        const csvKeys = csvs.Contents.map(({Key}) => ({Key}));
        csvParam.Delete = {
            Objects: csvKeys
        }

        await s3.deleteObjects(csvParam).promise()
    }

    await s3.deleteBucket({ Bucket: `${username}-img` }).promise();
    await s3.deleteBucket({ Bucket: `${username}-csv` }).promise();
    return true
}

const deleteUserAfterFailCreate = (username) => {
    client.query(`delete from Users where username=${username};`, (err, result) => {
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
              res.status(400).json("error in creating new user")
          } else {

            // Create csv bucket for user
            s3.createBucket({Bucket: `${name}-csv`}, (err, _) => {
                if (err) {
                    deleteUserAfterFailCreate(name)
                    return res.status(500).json("error in creating new user")
                } else {
                    // Create img bucket for user
                    s3.createBucket({Bucket: `${name}-img`}, (awserr, _) => {
                        if (awserr) {
                            deleteUserAfterFailCreate(name)
                            return res.status(500).json("error in creating new user")
                        } else { 
                            // successfully created 2 buckets and user in postres
                            return res.status(200).json({"username": name})
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
            return res.redirect('/dashboard')
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
            return res.redirect('/dashboard')
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
            const parsed = Papa.parse(stringBody, {header: false})

            parsed.data.forEach(question => {
                list.push(question)
            });
        }

        res.json({"questions": list})
    } catch (err) {
        console.log(err)
        res.status(500).send("Error getting files")
    }
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
        if(err) {
            res.status(500); return;
        }
        return res.json({"username": username, "contentsArray": data.Contents});
    });   
}

const getDashboard = (req, res) => {
    return res.sendFile(path.join(__dirname, '/views/dashboard.html'))
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
app.get('/dashboard', getDashboard)


/**
 * 
 * Init App
 */
app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '/views/index.html'))
})

const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log("Listening on port: ", + port)
})