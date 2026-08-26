import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.listen(port, (err) => {
  if (err) throw err;

  console.log(`Server is running on http://localhost:${port}, this will be used only when doing Webhook`);
});