// express
const express = require('express')
const app = express()

// aws s3
const AWS = require("aws-sdk")
const s3 = new AWS.S3()

// cyclic db
const db = require('cyclic-dynamodb')
const users = db.collection('users')

// misc
const cors = require('cors')

// security
const jwt = require('jsonwebtoken')
const helmet = require('helmet')

app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())

const dynamoOpts = {
  table: {
    name: process.env.CYCLIC_DB,
    hashKey: 'pk',
    hashPrefix: 'sid_',
    sortKey: 'sk',
    create: false
  },
  keepExpired: false,
  touchInterval: oneHourMs
}

const oneDayMs = 24 * oneHourMs
app.use(session({
  store: new DynamoDBStore(dynamoOpts),
  secret: process.env.SESSION_SECRET || 'THIS-IS-NOT-A-SECRET',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: 'auto',
    maxAge: oneDayMs
  }
  // unset: "destroy"
}))

// GET https://some-app.cyclic.app/files?name=
// get specific ".json" with the filename
app.get('/api/files', async (req, res) => {
  const filename = req.query.name + '.json'

  const s3File = await s3.getObject({
    Bucket: process.env.BUCKET,
    Key: filename,
  }).promise()

  res.set('Content-type', s3File.ContentType)
  res.send(s3File.Body.toString()).end()
})

// GET https://some-app.cyclic.app/api/listJson
// list all objects with ".json" as key inside s3 bucket
app.get('/api/listJson', async (req, res) => {
  const jsonArr = []

  const s3Objects = await s3.listObjects({
    Bucket: process.env.BUCKET,
  }).promise()

  const rawObj = s3Objects.Contents

  for (let index = 0; index < rawObj.length; index++) {
    if (rawObj[index].Key.includes(".json")) {
      jsonArr.push(rawObj[index]);
    }
  }

  res.send(jsonArr).end()

})

app.get('/api/listUser', async (req, res) => {
  const userObjects = await users.list()

  res.json(userObjects).end()
})

app.post('/api/signup', async (req, res) => {
  console.log(req.body)

  const email = req.body.email
  const password = req.body.password
  const role = 'dev'
  const uid = 'uid_' + Math.random().toString().slice(2)
  const uProps = {
    uid,
    email,
    password,
    role
  }

  const user = await users.set(email, uProps, { $index: ['uid'] })

  res.json(user.props).end()
})

// PROTECTED
const accessTokenSecret = process.env.SECRET_TOKEN
app.post('/api/signin', (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => { return u.username === username && u.password === password })

  if (user) {
    // Generate an access token
    const accessToken = jwt.sign({ username: user.username, role: user.role }, accessTokenSecret)

    res.json({ accessToken })
  }
  else
    res.send('Incorrect username or password')

})

// AUTH
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]

    jwt.verify(token, accessTokenSecret, (err, user) => {
      if (err)
        return res.sendStatus(403)

      req.user = user
      next()
    })
  }
  else
    res.sendStatus(401).end()
}

// PUT https://some-app.cyclic.app/api/files?name=
app.put('/api/files', authenticateJWT, async (req, res) => {
  const { role } = req.user

  if (role !== admin)
    return res.sendStatus(403)

  const filename = req.query.name + '.json'

  await s3.putObject({
    Body: JSON.stringify(req.body),
    Bucket: process.env.BUCKET,
    Key: filename,
  }).promise()

  res.set('Content-type', 'application/json')
  res.send(`${filename} updated`).end()
})

// DELETE https://some-app.cyclic.app/api/files?name=
app.delete('/api/files', authenticateJWT, async (req, res) => {
  const { role } = req.user

  if (role !== admin)
    return res.sendStatus(403)

  const filename = req.query.name + '.json'

  await s3.deleteObject({
    Bucket: process.env.BUCKET,
    Key: filename,
  }).promise()

  res.set('Content-type', 'application/json')
  res.send(`${filename} deleted`).end()
})

// /////////////////////////////////////////////////////////////////////////////
// Catch all handler for all other request.
app.use('*', (req, res) => {
  res.json({ msg: 'no route handler found', path: req.path, method: req.method }).end()
})

// /////////////////////////////////////////////////////////////////////////////
// Start the server
const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`index.js listening on ${port}`)
})
