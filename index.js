// express
const express = require('express')
const app = express()

// misc
require('dotenv').config()
const cors = require('cors')

// aws s3
const AWS = require("aws-sdk")
const s3 = new AWS.S3()
const s3Bucket = process.env.BUCKET

// security
const jwt = require('jsonwebtoken')
const helmet = require('helmet')

app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())

// GET https://some-app.cyclic.app/files?name=
// get specific filename
app.get('/api/files', async (req, res) => {
  const filename = req.query.name

  try {
    const s3File = await s3.getObject({
      Bucket: s3Bucket,
      Key: filename,
    }).promise()

    res.json(JSON.parse(s3File.Body.toString())).end()
  } catch (error) {
    if (error.code !== 'NoSuchKey')
      res.sendStatus(500).end()

    res.status(404).json({ message: `${filename} not found` }).end()
  }

})

// GET https://some-app.cyclic.app/listFiles
// list files with key 'pakej'
app.get('/api/listFiles', async (req, res) => {
  const jsonArr = []

  const s3Objects = await s3.listObjects({
    Bucket: s3Bucket,
  }).promise()

  const rawObj = s3Objects.Contents

  for (let index = 0; index < rawObj.length; index++) {
    if (rawObj[index].Key.includes("pakej")) {
      jsonArr.push(rawObj[index]);
    }
  }

  res.json(jsonArr).end()
})

// PROTECTED
const accessTokenSecret = process.env.SECRET_TOKEN

const users = [
  {
    username: process.env.ADMIN_USER,
    password: process.env.ADMIN_PASS,
    role: process.env.ADMIN_ROLE
  }
]

// POST https://some-app.cyclic.app/api/signin
app.post('/api/signin', (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => { return u.username === username && u.password === password })

  if (user) {
    // Generate an access token
    const accessToken = jwt.sign({ username: user.username, role: user.role }, accessTokenSecret)

    res.json({ accessToken }).end()
  }
  else
    res.status(403).json({ message: 'incorrect password or username' }).end()
})

// AUTH
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]

    jwt.verify(token, accessTokenSecret, (err, user) => {
      if (err)
        res.sendStatus(403).end()

      req.user = user
      next()
    })
  }
  else
    res.sendStatus(401).end()
}

// GET https://some-app.cyclic.app/listAll
app.get('/api/listAll', authenticateJWT, async (req, res) => {
  const { role } = req.user

  if (role !== 'admin')
    res.sendStatus(403).end()

  const jsonArr = []

  const s3Objects = await s3.listObjects({
    Bucket: s3Bucket,
  }).promise()

  const rawObj = s3Objects.Contents

  for (let index = 0; index < rawObj.length; index++) {
    jsonArr.push(rawObj[index]);
  }

  res.json(jsonArr).end()
})

// PUT https://some-app.cyclic.app/api/files?name=
app.put('/api/files', authenticateJWT, async (req, res) => {
  const { role } = req.user
  const filename = req.query.name + ".json"
  const s3File = ''

  if (role !== 'admin')
    res.sendStatus(403)

  // get first
  try {
    s3File = await s3.getObject({
      Bucket: s3Bucket,
      Key: filename,
    }).promise()

  } catch (error) {
    if (error.code === 'NoSuchKey') {
      await s3.putObject({
        Body: JSON.stringify(req.body),
        Bucket: s3Bucket,
        Key: filename,
      }).promise()

      res.json({ message: `${filename} added` }).end()
    }
    else if (error.code !== 'NoSuchKey') {
      res.json({ message: `${filename} already exist` }).end()
    }
    else
      res.sendStatus(500).end()
  }
})

// POST https://some-app.cyclic.app/api/files?name=
app.post('/api/files', authenticateJWT, async (req, res) => {
  const { role } = req.user
  const filename = req.query.name + ".json"

  if (role !== 'admin')
    res.sendStatus(403)

  // get first
  try {
    await s3.getObject({
      Bucket: s3Bucket,
      Key: filename,
    }).promise()
  } catch (error) {
    if (error.code === 'NoSuchKey')
      res.status(404).json({ message: `${filename} not found` }).end()

    res.sendStatus(500).end()
  }

  await s3.putObject({
    Body: JSON.stringify(req.body),
    Bucket: s3Bucket,
    Key: filename,
  }).promise()

  res.json({ message: `${filename} updated` }).end()
})

// DELETE https://some-app.cyclic.app/api/files?name=
app.delete('/api/files', authenticateJWT, async (req, res) => {
  const { role } = req.user
  const filename = req.query.name + ".json"

  if (role !== 'admin')
    res.sendStatus(403).end()

  // get first
  try {
    await s3.getObject({
      Bucket: s3Bucket,
      Key: filename,
    }).promise()
  } catch (error) {
    if (error.code === 'NoSuchKey')
      res.status(404).json({ message: `${filename} not found` }).end()

    res.sendStatus(500).end()
  }

  await s3.deleteObject({
    Bucket: s3Bucket,
    Key: filename,
  }).promise()

  res.json({ message: `${filename} deleted` }).end()
})

// /////////////////////////////////////////////////////////////////////////////
// Catch all handler for all other request.
app.use('*', (req, res) => {
  res.json({ message: 'no route handler found', path: req.path, method: req.method }).end()
})

// /////////////////////////////////////////////////////////////////////////////
// Start the server
const port = process.env.PORT
app.listen(port, () => {
  console.log(`slides-api listening on ${port}`)
})
