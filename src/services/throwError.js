const {saveStorage} = require("./storage");

async function throwError(errCtx) {
  try {
    console.log(errCtx);
  } catch {
    console.log("There was an error while displaying the error..")
  }

  // await saveStorage();
}

module.exports = throwError;