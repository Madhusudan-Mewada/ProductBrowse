# 🛍️ ProductBrowse — 200,000 Product Browser with Cursor Pagination

This project is a high-performance web application consisting of an **Express/TypeScript backend** and a **React/Vite/TypeScript frontend** designed to efficiently browse, filter, and paginate through a dataset of **200,000 products** without performance degradation.

---

## 🏗️ Architecture & Features

### 1. High-Performance Database (Neon PostgreSQL)
* **200,000 Sample Products**: Generated and inserted in **seconds** using a single SQL query leveraging PostgreSQL's `generate_series()`.
* **Database Indexes**: Optimized with composite index `(created_at DESC, id DESC)` for instant cursor-based query retrieval, and a single index on `category` for lightning-fast filtering.

### 2. Cursor-Based Pagination (vs. Offset-Based)
* **No Performance Drop**: Regular pagination (`LIMIT 20 OFFSET 100000`) causes the database to read and discard all previous rows, slowing down as page numbers grow. Cursor pagination queries records directly after the last seen row, taking constant time ($O(1)$) regardless of the depth of pages.
* **No Duplicate/Skipped Rows**: Real-time inserts/deletes won't cause items to shift between pages.
* **Opaque Cursor**: Cursor values are base64-encoded strings containing a composite of `(created_at, id)` to break timestamp ties safely.

### 3. Frontend & Dev Proxy
* **Vite-Proxy**: During local development, all API calls to `/api/...` are proxied to `http://localhost:3000` automatically.
* **Responsive UI**: Responsive design with raw CSS featuring chip-based filters, dynamic pagination navigation, and skeleton loaders during fetch states.

---

## 🛠️ Tech Stack

* **Frontend**: React 18, Vite, TypeScript, CSS (Vanilla)
* **Backend**: Node.js, Express, TypeScript, pg (node-postgres)
* **Database**: Neon Serverless PostgreSQL

---

## 🚀 Setup & Local Development

### 1. Clone & Install Dependencies

Run the following commands to install packages for both root (backend) and the frontend:

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Database Environment Setup

Create a `.env` file in the **root directory** (alongside backend files):

```env
DATABASE_URL=postgresql://<username>:<password>@<host>/<database>?sslmode=require
PORT=3000
```

### 3. Seeding the Database
To create the products table, setup indexes, and populate **200,000 products** instantly, run:

```bash
npm run seed
```
*Note: If the table already exists and contains data, seeding will be skipped.*

### 4. Running Locally

#### Start the Backend (Root folder)
```bash
npm run dev
```
The server will start at `http://localhost:3000`.

#### Start the Frontend (frontend/ folder)
Open a new terminal window:
```bash
cd frontend
npm run dev
```
The application will be available at `http://localhost:5173`. 
*(Vite proxies all calls starting with `/api` to the backend running at `localhost:3000` automatically).*

---

## 🌐 Production Deployment

### 1. Backend Deployment (Render)
* **Build Command**: `npm install && npm run build`
* **Start Command**: `npm run start`
* **Environment Variables**:
  * `DATABASE_URL`: Your Neon PostgreSQL Connection String
  * `PORT`: `3000` (Render allocates this dynamically)

After successful deployment, Render will provide a live URL, e.g., `https://user-management-system-2tv6.onrender.com`.

### 2. Frontend Deployment (Netlify)
* **Build Command**: `npm run build` (which compiles TypeScript `tsc` and bundles through `vite build`)
* **Publish Directory**: `frontend/dist`
* **Environment Variables (Required in Netlify settings)**:
  * **Key**: `VITE_BE_URL`
  * **Value**: `https://user-management-system-2tv6.onrender.com` *(Replace this with your actual backend URL from Render)*

---

## 📝 How the Code Works

### Opaque Cursor Structure
The backend encodes the cursor from the last product on the current page:
```typescript
const last = products[products.length - 1];
const raw = `${last.created_at.toISOString()}__${last.id}`;
const nextCursor = Buffer.from(raw).toString('base64');
```

And decodes it on subsequent requests to extract filtering criteria:
```typescript
const decoded = Buffer.from(cursorParam, 'base64').toString('utf8');
const [cursorCreatedAt, cursorId] = decoded.split('__');
```

### The Query SQL logic
Using the cursor values, it runs a comparative condition to fetch older posts:
```sql
SELECT id, name, category, price, created_at, updated_at
FROM products
WHERE (created_at < $1 OR (created_at = $1 AND id < $2))
ORDER BY created_at DESC, id DESC
LIMIT $3
```
This ensures the query starts exactly where the previous page left off, utilizing the composite index `idx_products_created_at_id` instantly.
