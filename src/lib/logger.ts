import pino from "pino";

const isDevelopment = process.env.NODE_ENV === "development";

export default pino({
  level: isDevelopment ? "debug" : "info",

  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ...(isDevelopment && {
        translateTime: "SYS:standard",
      }),
    },
  },
});