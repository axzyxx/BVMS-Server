# Backend environment variables (Render)

Set these in your Render service **Environment** (do not commit real secrets).

## Required

- **`MONGO_URI`**: MongoDB Atlas connection string

## Recommended

- **`PORT`**: Render sets this automatically; your code should read `process.env.PORT`
- **`CORS_ORIGIN`**: Comma-separated list of allowed frontend origins (Vercel URL and any custom domain)
- **`ADMIN_PHONE`**: Admin mobile number to auto-create the admin account on first run
- **`ADMIN_PASSWORD`**: Admin password to auto-create the admin account on first run
- **`ADMIN_USERNAME`**: Optional (defaults to `Admin`)

## If using SMS (Twilio routes)

- **`TWILIO_ACCOUNT_SID`**
- **`TWILIO_AUTH_TOKEN`**
- **`TWILIO_PHONE_NUMBER`**

