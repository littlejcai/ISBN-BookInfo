import express from 'express'
import { searchAndReplace } from './playground/search_and_replace'

const app = express()
const port = 3000

// http trigger
app.get('/search_and_replace', async (req, res) => {
  await searchAndReplace();
  res.send('success!!!')
});


app.get('/', async (req, res) => {
  res.send('hello world')
});

app.listen(port, () => {
  // Code.....
  console.log('Listening on port: ' + port)
})