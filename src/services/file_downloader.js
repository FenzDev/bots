const { default: got } = require("got");
const fs = require("fs")

async function downloadFile (url, path) {
  const stream = got.stream(url, {
    timeout: {
      connect: 10_000,  // time to connect
      response: 200_000_000       // disable read timeout
    },
    retry: {
      limit: 5,      // retry on failure
      methods: ['GET'],
    },
  });

  stream.pipe(fs.createWriteStream(path));

  return new Promise((resolve, reject) => {
    stream.on("end", resolve);
    stream.on("error", reject);
  });
};

module.exports = {downloadFile};