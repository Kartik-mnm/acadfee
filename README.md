# 🎓 AcadFee – Multi-Branch Coaching Institute Fee Management

A full-stack web application for managing fees across multiple branches.
All 3 branches access the same app via browser — hosted free on Render.

---

## 🗂️ Project Structure

```
fee-app/
├── server/          ← Node.js + Express backend API
│   ├── index.js
│   ├── db.js
│   ├── middleware.js
│   ├── schema.sql   ← Run this once to set up database
│   └── routes/
│       ├── auth.js
│       ├── branches.js
│       ├── batches.js
│       ├── students.js
│       ├── fees.js
│       ├── payments.js
│       └── reports.js
└── client/          ← React frontend
    └── src/
        ├── pages/   ← Dashboard, Students, Fees, Payments, Reports, Users
        └── context/ ← Auth context
```

---

## 🚀 Step-by-Step Deployment on Render (Free)

### STEP 1 — Push Code to GitHub

1. Create a free account at https://github.com
2. Create a new repository called `acadfee`
3. Upload all files (or use Git):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/acadfee.git
   git push -u origin main
   ```

---

### STEP 2 — Create PostgreSQL Database on Render

1. Go to https://render.com → Sign up free
2. Click **"New +"** → **"PostgreSQL"**
3. Fill in:
   - Name: `acadfee-db`
   - Database: `acadfee`
   - User: `acadfee_user`
   - Region: Singapore (closest to India)
   - Plan: **Free**
4. Click **"Create Database"**
5. Wait 1–2 minutes, then copy the **"Internal Database URL"** (starts with `postgresql://...`)

---

### STEP 3 — Run the Database Schema

1. On Render, go to your PostgreSQL database
2. Click **"Connect"** → **"PSQL Command"** → copy the command
3. Open your terminal and paste it (or use any PostgreSQL client like DBeaver/pgAdmin)
4. Run the schema:
   ```sql
   -- Paste the entire contents of server/schema.sql and run it
   ```
   This creates all tables + 3 branches + default Super Admin.

---

### STEP 4 — Deploy the Backend (Node.js API)

1. On Render → Click **"New +"** → **"Web Service"**
2. Connect your GitHub repo `acadfee`
3. Fill in:
   - **Name**: `acadfee-api`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Plan**: Free
4. Scroll to **"Environment Variables"** → Add:
   ```
   DATABASE_URL   = (paste the Internal Database URL from Step 2)
   JWT_SECRET     = mySecretKey2025ChangeThis
   NODE_ENV       = production
   ```
5. Click **"Create Web Service"**
6. Wait for deployment. Note your API URL: `https://acadfee-api.onrender.com`

---

### STEP 5 — Deploy the Frontend (React)

1. On Render → Click **"New +"** → **"Static Site"**
2. Connect the same GitHub repo
3. Fill in:
   - **Name**: `acadfee-app`
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
4. Add **Environment Variable**:
   ```
   REACT_APP_API_URL = https://acadfee-api.onrender.com/api
   ```
5. Click **"Create Static Site"**
6. Wait for build. Your app URL: `https://acadfee-app.onrender.com`

---

### STEP 6 — Share with All 3 Branches

Share this URL with all branches:
```
https://acadfee-app.onrender.com
```

All staff open this in their browser — no installation needed!

---

## 🔐 Login Credentials

### Default Super Admin
- **Email**: admin@academy.com
- **Password**: Admin@1234
- **Access**: All 3 branches, all data, user management

### Creating Branch Manager Accounts
1. Login as Super Admin
2. Go to **"Users"** in the sidebar
3. Click **"+ Add User"**
4. Select Role: **Branch Manager** and assign their branch
5. Share the credentials with that branch

---

## 👥 User Roles

| Role | Access |
|------|--------|
| **Super Admin** | All branches, all reports, create users, manage branches |
| **Branch Manager** | Own branch only — students, fees, payments, reports |

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏫 Student Registration | Full profile, batch assignment, admission fee, discount |
| 📚 Batch Management | Multiple batches per branch with 4 fee structures |
| 📋 Fee Records | Auto-generate monthly records for all students |
| 💳 Payments | Record cash/UPI payments, auto-calculate balance |
| 🧾 Receipts | Printable receipts with receipt number |
| ⚠️ Overdue Tracking | One-click mark-overdue, overdue list with contacts |
| 📊 Reports | Monthly trend, branch summary, export to CSV |
| 🔐 Role-based Access | Super admin sees all; branch managers see only their branch |

---

## 💡 Important Notes

### Free Tier Limitations (Render)
- The backend "spins down" after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- To avoid this, upgrade to Render's **Starter plan ($7/month)**

### Local Development
```bash
# Terminal 1 — Backend
cd server
npm install
# Create a .env file with DATABASE_URL and JWT_SECRET
npm run dev

# Terminal 2 — Frontend
cd client
npm install
npm start
```

### .env file for local development (server/.env)
```
DATABASE_URL=postgresql://localhost/acadfee
JWT_SECRET=devSecret123
NODE_ENV=development
PORT=5000
```

---

## 🔧 Customization

### Change Academy Name
Search for `"AcadFee Institute"` and `"AcadFee"` in the codebase and replace with your institute name.

### Add More Branches
Login as Super Admin → The 3 branches are seeded automatically.
To add more, use: `POST /api/branches` with `{ name, address, phone }`.

### Change Default Admin Password
After first login, contact your developer to update via SQL:
```sql
-- Run this after generating a new bcrypt hash
UPDATE users SET password = 'NEW_BCRYPT_HASH' WHERE email = 'admin@academy.com';
```

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| API not connecting | Check `REACT_APP_API_URL` env variable in frontend |
| Database errors | Re-run `schema.sql` on your Render PostgreSQL |
| Login fails | Check `JWT_SECRET` env var on backend |
| Slow first load | Normal on free tier — Render wakes up the server |
