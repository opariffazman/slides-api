const express = require('express');
const Joi = require('joi'); //used for validation
const app = express();
const AWS = require("aws-sdk");
const s3 = new AWS.S3()
const bodyParser = require('body-parser');

app.use(bodyParser.json())

// store something
await s3.putObject({
  Body: JSON.stringify({key:"value"}),
  Bucket: "cyclic-tender-tuxedo-bee-ap-southeast-1",
  Key: "some_files/my_file.json",
}).promise()

// get it back
let my_file = await s3.getObject({
  Bucket: "cyclic-tender-tuxedo-bee-ap-southeast-1",
  Key: "some_files/my_file.json",
}).promise()

console.log(JSON.parse(my_file))

app.use(express.json());

const books = [
  { title: 'Harry Potter', id: 1 },
  { title: 'Twilight', id: 2 },
  { title: 'Lorien Legacies', id: 3 }
]

//READ Request Handlers
// curl -i https://some-app.cyclic.app/myFile.txt
app.get('/api/myFile', async (req,res) => {
  let filename = req.path.slice(1)

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

// curl -i -XPUT --data '{"k1":"value 1", "k2": "value 2"}' -H 'Content-type: application/json' https://some-app.cyclic.app/myFile.txt
app.put('/api/myFile', async (req,res) => {
  let filename = req.path.slice(1)

  console.log(typeof req.body)

  await s3.putObject({
    Body: JSON.stringify(req.body),
    Bucket: process.env.BUCKET,
    Key: filename,
  }).promise()

  res.set('Content-type', 'text/plain')
  res.send('ok').end()
})

app.get('/', (req, res) => {
  res.send('Welcome to Edurekas REST API with Node.js Tutorial!!');
});

app.get('/api/books', (req, res) => {
  res.send(books);
});

app.get('/api/books/:id', (req, res) => {
  const book = books.find(c => c.id === parseInt(req.params.id));

  if (!book) res.status(404).send('<h2 style="font-family: Malgun Gothic; color: darkred;">Ooops... Cant find what you are looking for!</h2>');
  res.send(book);
});

//CREATE Request Handler
app.post('/api/books', (req, res) => {

  const { error } = validateBook(req.body);
  if (error) {
    res.status(400).send(error.details[0].message)
    return;
  }
  const book = {
    id: books.length + 1,
    title: req.body.title
  };
  books.push(book);
  res.send(book);
});

//UPDATE Request Handler
app.put('/api/books/:id', (req, res) => {
  const book = books.find(c => c.id === parseInt(req.params.id));
  if (!book) res.status(404).send('<h2 style="font-family: Malgun Gothic; color: darkred;">Not Found!! </h2>');

  const { error } = validateBook(req.body);
  if (error) {
    res.status(400).send(error.details[0].message);
    return;
  }

  book.title = req.body.title;
  res.send(book);
});

//DELETE Request Handler
app.delete('/api/books/:id', (req, res) => {

  const book = books.find(c => c.id === parseInt(req.params.id));
  if (!book) res.status(404).send('<h2 style="font-family: Malgun Gothic; color: darkred;"> Not Found!! </h2>');

  const index = books.indexOf(book);
  books.splice(index, 1);

  res.send(book);
});

function validateBook(book) {
  const schema = {
    title: Joi.string().min(3).required()
  };
  return Joi.validate(book, schema);

}

//PORT ENVIRONMENT VARIABLE
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Listening on port ${port}..`));
