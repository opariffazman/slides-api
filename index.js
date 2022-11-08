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

  const s3File = await s3.getObject({
    Bucket: s3Bucket,
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
    Bucket: s3Bucket,
  }).promise()

  const rawObj = s3Objects.Contents

  for (let index = 0; index < rawObj.length; index++) {
    if (rawObj[index].Key.includes(".json")) {
      jsonArr.push(rawObj[index]);
    }
  }

  res.send(jsonArr).end()

})

app.get('/api/listPackage', async (req, res) => {
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

  res.send(jsonArr).end()
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
  const filename = req.query.name

  if (role !== 'admin')
    return res.sendStatus(403)

  await s3.putObject({
    Body: JSON.stringify(req.body),
    Bucket: s3Bucket,
    Key: filename,
  }).promise()

  res.set('Content-type', 'application/json')
  res.send(`${filename} updated`).end()
})

// DELETE https://some-app.cyclic.app/api/files?name=
app.delete('/api/files', authenticateJWT, async (req, res) => {
  const { role } = req.user
  const filename = req.query.name

  if (role !== 'admin')
    return res.sendStatus(403)

  await s3.deleteObject({
    Bucket: s3Bucket,
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
const port = process.env.PORT
app.listen(port, () => {
  console.log(`slides-rest-api listening on ${port}`)
})
