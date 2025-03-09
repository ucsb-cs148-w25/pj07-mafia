# Deployment Documentation

This document outlines the steps to deploy our project (both frontend and backend) to our Dokku server. It is maintained by the Deployment Document Coordinator (Andy) 

## Overview

Our project is structured as a monorepo with:
- **Frontend:** A React app located in the `main-app` directory.
- **Backend:** A Node.js server located in the `server` directory.

We deploy these as two separate Dokku apps:
- **mafia:** For the frontend.
- **mafia-backend:** For the backend.

All code to be deployed is maintained on the `main` branch.
There are some other branches which can be used for testing.

## Prerequisites

- Log in / SSH onto the terminal with your CSIL account
- Log in / SSH onto dokku-07.
- The Git repository is hosted at [https://github.com/ucsb-cs148-w25/pj07-mafia](https://github.com/ucsb-cs148-w25/pj07-mafia).
- The `main` branch contains the latest changes, including:
  - Frontend updates (e.g., socket.io URL changed to point to the deployed backend domain).
  - Backend updates (ensuring the server listens on the dynamic port provided via `process.env.PORT`).
 - Important note: Backend Servers must be `PORT 5000`
## Deployment Steps

### 1. Deploying the Frontend (mafia)

1. **Create the App (if not already created):**

   ```bash
   dokku apps:create mafia
   ```

2. **Configure Buildpacks & Monorepo Settings:**

   Use the monorepo buildpack so Dokku builds from the `main-app` folder:

   ```bash
   dokku buildpacks:set mafia https://github.com/lstoll/heroku-buildpack-monorepo.git
   dokku config:set mafia MONOREPO_SUBFOLDER=main-app
   dokku buildpacks:add mafia https://github.com/heroku/heroku-buildpack-nodejs.git
   ```

3. **Deploy from the `Main` Branch:**

   ```bash
   dokku git:sync mafia https://github.com/ucsb-cs148-w25/pj07-mafia main
   dokku ps:rebuild mafia
   ```

4. **Verify the Deployment:**

   Visit: [https://mafia.dokku-07.cs.ucsb.edu](https://mafia.dokku-07.cs.ucsb.edu)
   
   Check logs if necessary:

   ```bash
   dokku logs mafia
   ```

### 2. Deploying the Backend (mafia-backend)

1. **Create the App (if not already created):**

   ```bash
   dokku apps:create mafia-backend
   ```

2. **Configure Buildpacks & Monorepo Settings:**

   Use the monorepo buildpack so Dokku builds from the `server` folder:

   ```bash
   dokku buildpacks:set mafia-backend https://github.com/lstoll/heroku-buildpack-monorepo.git
   dokku config:set mafia-backend APP_BASE=server
   dokku buildpacks:add mafia-backend https://github.com/heroku/heroku-buildpack-nodejs.git
   ```

3. **Deploy from the `Main` Branch:**

   ```bash
   dokku git:sync mafia-backend https://github.com/ucsb-cs148-w25/pj07-mafia Main
   dokku ps:rebuild mafia-backend
   ```


4. **Verify the Deployment:**

   Visit: [https://mafia-backend.dokku-07.cs.ucsb.edu](https://mafia-backend.dokku-07.cs.ucsb.edu)
   
### 3. Enabling HTTPS with Let's Encrypt

For both apps, enable HTTPS as follows:

1. **Set the Let's Encrypt Email:**
   Replace `your-email@example.com` with your actual email address.

   ```bash
   dokku letsencrypt:set mafia email your-email@example.com
   dokku letsencrypt:set mafia-backend email your-email@example.com
   ```

2. **Enable Let's Encrypt:**

   ```bash
   dokku letsencrypt:enable mafia
   dokku letsencrypt:enable mafia-backend
   ```
