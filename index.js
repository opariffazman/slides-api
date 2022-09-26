// express
const express = require('express')
const app = express()

// aws s3
const AWS = require("aws-sdk")
const s3 = new AWS.S3()

// misc
const cors = require('cors');
const path = require('path');

//auth
const basicAuth = require('express-basic-auth')
const cookieParser = require('cookie-parser')

app.use(express.json())
app.use(cors())

// GET https://some-app.cyclic.app/files?name=
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

// PROTECTED
app.use(cookieParser())

app.use(basicAuth({
  users: { 'admin': process.env.PASS }
}))

// sentUserCookie creates a cookie which expires after one day
const sendUserCookie = (res) => {
  // Our token expires after one day
  const oneDayToSeconds = 24 * 60 * 60
  res.cookie('user', 'admin', { maxAge: oneDayToSeconds})
}

// PUT https://some-app.cyclic.app/api/admin/files?name=
app.put('/api/admin/files', async (req, res) => {
  if (!req.cookie.user === 'admin')
    return

  const filename = req.query.name + '.json'

  await s3.putObject({
    Body: JSON.stringify(req.body),
    Bucket: process.env.BUCKET,
    Key: filename,
  }).promise()

  res.set('Content-type', 'application/json')
  res.send(`${filename} updated`).end()
})

// DELETE https://some-app.cyclic.app/api/admin/files?name=
app.delete('/api/admin/files', async (req, res) => {
  if (!req.cookie.user === 'admin')
    return

  const filename = req.query.name + '.json'

  await s3.deleteObject({
    Bucket: process.env.BUCKET,
    Key: filename,
  }).promise()

  res.set('Content-type', 'application/json')
  res.send(`${filename} deleted`).end()
})

app.get('/auth', async (req, res) => {
  sendUserCookie(res)
  res.send("Authenticated").end()
})

app.use('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, '/signin/index.html'));
})

// /////////////////////////////////////////////////////////////////////////////
// Catch all handler for all other request.
app.use('*', (req, res) => {
  res.sendFile(path.join(__dirname, '/index.html'));
})

// /////////////////////////////////////////////////////////////////////////////
// Start the server
const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`index.js listening at http://localhost:${port}`)
})
