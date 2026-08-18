# MongoDB Atlas Setup Guide

This guide walks you through setting up MongoDB Atlas with Vector Search support for the Musée chatbot.

## Step 1: Create a Free MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up with your email or use Google/GitHub authentication
3. Complete the registration form

## Step 2: Create a Free Cluster (M0)

1. After logging in, click **"Create"** or **"Build a Database"**
2. Choose **"M0 Free"** tier (supports vector search!)
3. **Provider & Region**: Choose AWS, Google Cloud, or Azure - pick the region closest to you
4. **Cluster Name**: You can use the default or name it `musee-cluster`
5. Click **"Create Cluster"** (takes 3-5 minutes to provision)

## Step 3: Set Up Database Access

1. Go to **"Database Access"** in the left sidebar (under SECURITY)
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Username: `musee-admin` (or your preferred username)
5. **Auto-generate a secure password** and **save it immediately**
6. **Database User Privileges**: Select **"Read and write to any database"**
7. Click **"Add User"**

## Step 4: Configure Network Access

1. Go to **"Network Access"** in the left sidebar (under SECURITY)
2. Click **"Add IP Address"**
3. For development: Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - For production, restrict to specific IPs
4. Click **"Confirm"**

## Step 5: Get Your Connection String

1. Go back to **"Database"** in the left sidebar
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Driver: **Node.js**, Version: **5.5 or later**
5. Copy the connection string - it looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` with your database username
7. Replace `<password>` with your database password
8. Add the database name after `.net/`: `museum-guide`

Your final connection string should look like:
```
mongodb+srv://musee-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/museum-guide?retryWrites=true&w=majority
```

## Step 6: Update Your .env File

```bash
# Replace your existing MONGODB_URI with the Atlas connection string
MONGODB_URI=mongodb+srv://musee-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/museum-guide?retryWrites=true&w=majority
OPENAI_API_KEY=your_openai_api_key_here
```

## Step 7: Migrate Your Data

Run the existing seed script to populate your Atlas database:

```bash
npm run seed
```

This will create all your artworks in the Atlas cluster.

## Step 8: Generate Embeddings

Run the embeddings seed script:

```bash
npm run seed:embeddings
```

This will generate vector embeddings for all artworks.

## Step 9: Create the Vector Search Index

1. In Atlas, go to **"Atlas Search"** tab (or click "Search" in left sidebar)
2. Click **"Create Search Index"**
3. Choose **"JSON Editor"**
4. Select database: `museum-guide`
5. Select collection: `artworks`
6. Paste this JSON:

```json
{
  "name": "artwork_embeddings",
  "type": "vectorSearch",
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

7. Click **"Next"** then **"Create Search Index"**
8. Wait 1-2 minutes for the index to become **"Active"**

## Step 10: Test the Vector Search

Start your server:

```bash
npm start
```

Upload an artwork image and verify that the response includes `similarArtworks` in the JSON.

---

## Troubleshooting

### Connection Timeout
- Check that your IP is whitelisted in Network Access
- Verify your connection string has the correct username/password

### Authentication Failed
- Double-check your username and password
- Make sure the password is URL-encoded (replace special characters)

### Vector Search Not Working
- Ensure the index status shows "Active" in Atlas Search
- Verify the index name is exactly `artwork_embeddings`
- Check that embeddings were generated (inspect a document in Atlas)

### URL Encoding Passwords
If your password contains special characters, encode them:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`

---

## Cost & Limits

**M0 Free Tier:**
- ✅ 512 MB storage
- ✅ Shared RAM
- ✅ Vector Search supported
- ✅ Perfect for development and small projects
- ✅ No credit card required

For production with larger datasets, consider upgrading to M10 or higher.
