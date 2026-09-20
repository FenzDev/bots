import pino from "pino";

export default pino({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",

  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
    },
  },
});
