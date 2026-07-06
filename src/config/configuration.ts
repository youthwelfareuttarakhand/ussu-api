export default () => ({
  port: parseInt(process.env.PORT ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001").split(","),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? "2h",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? "7d",
  },
});
