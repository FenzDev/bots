import Express from "express"

const app = Express();
const port = process.env.PORT ?? 3000;

app.listen(3000, (err)=> {
  if (err) throw err;

  console.log(`Server is running on http://localhost:${port}`)
});