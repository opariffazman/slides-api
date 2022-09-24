const express = require('express')
const app = express()
const AWS = require("aws-sdk");
const s3 = new AWS.S3()
const bodyParser = require('body-parser');
const cors = require('cors');

app.use(bodyParser.json())
app.use(cors());

// GET https://some-app.cyclic.app/files?name=
app.get('/api/files', async (req, res) => {
  const filename = req.query.name + '.json';

  let s3File = await s3.getObject({
    Bucket: process.env.BUCKET,
    Key: filename,
  }).promise()

  res.set('Content-type', s3File.ContentType)
  res.send(s3File.Body.toString()).end()
})

// GET https://some-app.cyclic.app/api/listJson
// list all objects with .json key inside s3 bucket
app.get('/api/listJson', async (req, res) => {
  let jsonArr = [];

  let s3Objects = await s3.listObjects({
    Bucket: process.env.BUCKET,
  }).promise()

  let raw = s3Objects.Contents

  for (let index = 0; index < raw.length; index++) {
    if (raw[index].Key.includes(".json")) {
      jsonArr.push(raw[index]);
    }
  }

  res.send(jsonArr).end()

})

// PUT https://some-app.cyclic.app/files?name=
app.put('/api/files', async (req, res) => {
  const filename = req.query.name + '.json';

  await s3.putObject({
    Body: JSON.stringify(req.body),
    Bucket: process.env.BUCKET,
    Key: filename,
  }).promise()

  res.set('Content-type', 'application/json')
  res.send(`${filename} updated`).end()
})

// DELETE https://some-app.cyclic.app/files?name=
app.delete('/api/files', async (req, res) => {
  const filename = req.query.name + '.json';

  await s3.deleteObject({
    Bucket: process.env.BUCKET,
    Key: filename,
  }).promise()

  res.set('Content-type', 'application/json')
  res.send('`${filename} deleted`').end()
})

// /////////////////////////////////////////////////////////////////////////////
// Catch all handler for all other request.
app.use('*', (req, res) => {
  res.sendStatus(404).end()
})

// /////////////////////////////////////////////////////////////////////////////
// Start the server
const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`index.js listening at http://localhost:${port}`)
})
