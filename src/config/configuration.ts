export default () => ({
  port: parseInt(process.env.PORT ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001").split(","),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? "2h",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? "7d",
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
    // Admission fee paid at the end of the dashboard admission form — the
    // only payment in the flow, signup itself is free. Category-based per
    // the official form: SC/ST/PwD pay the concession rate, everyone else
    // pays the full rate (see AdmissionsService.feeForCategory).
    admissionFeeFullPaise: 100000,
    admissionFeeConcessionPaise: 50000,
  },
  azureStorage: {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING ?? "",
    container: process.env.AZURE_STORAGE_CONTAINER ?? "",
  },
});
