import pino from "pino";

export default pino({
  level: process.env.NODE_ENV==='development'? 'debug': "info",

  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        }
      : undefined,
});
