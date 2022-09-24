const express = require('express')
const app = express()
const AWS = require("aws-sdk");
const s3 = new AWS.S3()
const bodyParser = require('body-parser');
const cors = require('cors');

app.use(bodyParser.json())
app.use(cors());

// curl -i https://some-app.cyclic.app/files?name=
app.get('/api/files', async (req, res) => {
  const filename = req.query.name;

  try {
    let s3File = await s3.getObject({
      Bucket: process.env.BUCKET,
      Key: filename,
    }).promise()

    res.set('Content-type', s3File.ContentType)
    res.send(s3File.Body.toString()).end()
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      console.log(`No such key ${filename}`)
      res.sendStatus(404).end()
    } else {
      console.log(error)
      res.sendStatus(500).end()
    }
  }
})

// list all json objects  inside s3 bucket
app.get('/api/listJson', async (req, res) => {
  let jsonArr = [];
  try {
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
  } catch (error) {
    console.log(error)
    res.sendStatus(500).end()
  }
})

app.put('*', async (req, res) => {
  let filename = req.path.slice(1)

  console.log(typeof req.body)

  await s3.putObject({
    Body: JSON.stringify(req.body),
    Bucket: process.env.BUCKET,
    Key: filename,
  }).promise()

  res.set('Content-type', 'application/json')
  res.send('ok').end()
})

// curl -i -XDELETE https://some-app.cyclic.app/myFile.txt
app.delete('*', async (req, res) => {
  let filename = req.path.slice(1)

  await s3.deleteObject({
    Bucket: process.env.BUCKET,
    Key: filename,
  }).promise()

  res.set('Content-type', 'application/json')
  res.send('ok').end()
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
