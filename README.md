# Meenarh Logistics Backend API

Production-ready Node.js backend for Meenarh Logistics — a Lagos-based delivery tracking platform.

## Tech Stack

- **Node.js** with Express.js
- **MySQL** (mysql2 with promise API)
- **JWT** authentication
- **bcrypt** password hashing
- **Zod** validation
- **express-rate-limit** for public route protection
- **CORS** enabled

## Features

- ✅ Customer signup and authentication with JWT (7-day expiry)
- ✅ User profiles with phone and default address storage
- ✅ Order creation with automatic tracking number generation (authenticated users only)
- ✅ Order history for authenticated customers
- ✅ Real-time order tracking by tracking number (public)
- ✅ Admin authentication with JWT (7-day expiry)
- ✅ Role-based access control (admin/staff)
- ✅ Customer management for admins (list, profile, order history, cart)
- ✅ Admin user creation (admin only)
- ✅ Order status management with event timeline
- ✅ Zone-based pricing calculation
- ✅ Rate limiting on public endpoints (400 req/15 min per IP in production, 5000 in development; not applied to `/api/cart` or other authenticated mounts)
- ✅ Prepared SQL statements (no raw queries)
- ✅ Transaction support for data integrity
- ✅ Clean error handling with production/dev modes
- ✅ Blog post management (create, edit, publish, delete) with slug generation
- ✅ Company settings management (dynamic contact info)
- ✅ Promo/discount codes with expiry, usage limits, and usage tracking
- ✅ Analytics event tracking (page views, orders, signups) with dashboard aggregations

## Project Structure

```
server/
├── package.json
├── .env.example
├── schema.sql
├── migrations/
│   └── admin-features.sql           # Blog, settings, promo codes, analytics tables
└── src/
    ├── server.js                    # Entry point
    ├── app.js                       # Express configuration
    ├── config/
    │   └── db.js                    # MySQL connection pool
    ├── routes/
    │   ├── public.routes.js         # Public API routes
    │   ├── user.routes.js           # Customer auth & profile routes
    │   ├── admin.routes.js          # Protected admin routes
    │   ├── blog.routes.js           # Blog (public read + admin CRUD)
    │   ├── settings.routes.js       # Company settings (public read + admin write)
    │   ├── promo.routes.js          # Promo codes (public validate + admin CRUD)
    │   └── analytics.routes.js      # Analytics (public track + admin read)
    ├── controllers/
    │   ├── order.controller.js      # Order endpoint handlers
    │   ├── user.controller.js       # Customer endpoint handlers
    │   ├── admin.controller.js      # Admin endpoint handlers
    │   ├── blog.controller.js       # Blog endpoint handlers
    │   ├── settings.controller.js   # Settings endpoint handlers
    │   ├── promo.controller.js      # Promo code endpoint handlers
    │   └── analytics.controller.js  # Analytics endpoint handlers
    ├── services/
    │   ├── order.service.js         # Order business logic
    │   ├── user.service.js          # Customer business logic
    │   ├── pricing.service.js       # Price calculation
    │   ├── blog.service.js          # Blog business logic + slug generation
    │   ├── settings.service.js      # Company settings business logic
    │   ├── promo.service.js         # Promo code validation & usage tracking
    │   └── analytics.service.js     # Analytics aggregation queries
    ├── middleware/
    │   ├── auth.middleware.js       # JWT verification
    │   ├── role.middleware.js       # Role-based access
    │   ├── rateLimit.middleware.js  # Rate limiting
    │   └── error.middleware.js      # Global error handler
    ├── utils/
    │   ├── generateTracking.js      # Tracking number generator
    │   └── jwt.js                   # JWT sign/verify utilities
    └── validators/
        ├── order.validator.js       # Order input validation (Zod)
        ├── user.validator.js        # Customer input validation (Zod)
        ├── auth.validator.js        # Auth input validation (Zod)
        ├── blog.validator.js        # Blog input validation (Zod)
        └── promo.validator.js       # Promo code input validation (Zod)
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=meenarh_logistics
DB_PORT=3306
JWT_SECRET=your-strong-secret-key
NODE_ENV=development

# Paystack card/bank payments (see "Paystack" below)
PAYSTACK_SECRET_KEY=sk_test_...
APP_PUBLIC_URL=http://localhost:3000
```

### Paystack

Checkout uses Paystack: the API initializes a transaction with an amount computed from the cart (and server-side promo validation), then creates orders only after Paystack confirms payment.

**Environment**

- `PAYSTACK_SECRET_KEY` — secret key from the Paystack dashboard (server only; never expose in the browser).
- `APP_PUBLIC_URL` — full origin of the customer-facing Next.js app, **no trailing slash** (e.g. `http://localhost:3000` in dev). Set this in **`meenarh-server/.env`** (the API process); values from `meenarh-web/.env` are **not** visible to Express. Used for Paystack `callback_url` (`{APP_PUBLIC_URL}/dashboard/payment/callback`). In local dev, if unset, the server defaults to `http://localhost:3000` and logs a warning. Production requires `APP_PUBLIC_URL` explicitly.

**Webhook**

Register this URL in Paystack (Settings → API & Webhooks → Webhook URL):

`https://<your-api-host>/api/webhooks/paystack`

The server verifies each webhook with **HMAC-SHA512** of the raw JSON body using your secret key. In production, follow [Paystack IP allowlist](https://paystack.com/docs/payments/webhooks#ip-addresses) if you restrict inbound traffic.

**Database**

Apply the payment intents migration after your main schema:

```bash
mysql -u root -p meenarh_logistics < migrations/payment-intents.sql
```

**Test cards**

Use Paystack’s test mode and [test payments documentation](https://paystack.com/docs/payments/test-payments) for card numbers and flows.

### 3. Set Up Database

Run the SQL schema to create tables and seed initial data:

```bash
mysql -u root -p < schema.sql
```

This creates:
- `users` table (admin/staff accounts)
- `customers` table (customer accounts with phone and default address)
- `zones` table (Lagos delivery zones with pricing)
- `orders` table (order details linked to customers)
- `order_events` table (order status timeline)

**Default zones seeded:**
- Mainland: ₦1,500 base + ₦100/km
- Island: ₦2,000 base + ₦120/km
- Expanding: ₦2,500 base + ₦150/km

### 4. Create an Admin User

```sql
INSERT INTO users (name, email, password_hash, role) VALUES
('Admin User', 'admin@meenarh.com', '$2b$10$[bcrypt-hash-here]', 'admin');
```

To generate a bcrypt hash for password `admin123`:

```bash
node -e "console.log(require('bcrypt').hashSync('admin123', 10))"
```

### 5. Run the Server

**Development mode (with nodemon):**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

Server will start on `http://localhost:5000` (or your configured PORT).

## API Endpoints

### Customer Authentication

#### Customer Signup

**Description:** Registers a new customer account. Validates input, checks for duplicate email, hashes password with bcrypt, creates customer record, and returns a JWT token valid for 7 days. Phone and default address are optional but recommended for faster order creation.

```http
POST /api/user/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "securepass123",
  "phone": "08012345678",
  "default_address": "123 Allen Avenue, Ikeja"
}
```

**Request Fields:**
- `name` (required): Full name (minimum 2 characters)
- `email` (required): Valid email address
- `password` (required): Password (minimum 6 characters)
- `phone` (optional): Contact phone number (min 7 characters)
- `default_address` (optional): Default pickup address (min 5 characters)

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "08012345678",
      "default_address": "123 Allen Avenue, Ikeja"
    }
  }
}
```

#### Customer Login

**Description:** Authenticates a customer and returns a JWT token valid for 7 days. Validates credentials, compares password with stored bcrypt hash, and generates signed JWT with customer ID, email, and type.

```http
POST /api/user/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "securepass123"
}
```

**Request Fields:**
- `email` (required): Valid email address
- `password` (required): User password (minimum 6 characters)

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "08012345678",
      "default_address": "123 Allen Avenue, Ikeja"
    }
  }
}
```

#### Get Profile (Protected)

**Description:** Retrieves the authenticated customer's profile information. Returns all profile data except password hash. Requires JWT authentication.

```http
GET /api/user/profile
Authorization: Bearer <token>
```

**Headers:**
- `Authorization` (required): Bearer token obtained from signup/login

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "08012345678",
    "default_address": "123 Allen Avenue, Ikeja",
    "created_at": "2026-02-16T10:00:00.000Z",
    "updated_at": "2026-02-16T10:00:00.000Z"
  }
}
```

#### Update Profile (Protected)

**Description:** Updates the authenticated customer's phone number and/or default address. At least one field must be provided. Requires JWT authentication.

```http
PATCH /api/user/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "08098765432",
  "default_address": "45 New Street, Lekki"
}
```

**Headers:**
- `Authorization` (required): Bearer token obtained from signup/login

**Request Fields:**
- `phone` (optional): New phone number (min 7 characters)
- `default_address` (optional): New default address (min 5 characters)
- At least one field must be provided

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "08098765432",
    "default_address": "45 New Street, Lekki",
    "created_at": "2026-02-16T10:00:00.000Z",
    "updated_at": "2026-02-16T14:30:00.000Z"
  }
}
```

#### Get Order History (Protected)

**Description:** Retrieves all orders created by the authenticated customer, ordered by creation date (most recent first). Shows order summary with tracking numbers, receiver info, status, and timestamps. Requires JWT authentication.

```http
GET /api/user/orders
Authorization: Bearer <token>
```

**Headers:**
- `Authorization` (required): Bearer token obtained from signup/login

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tracking_number": "MN-2026-0001",
      "sender_name": "John Doe",
      "receiver_name": "Jane Smith",
      "pickup_address": "123 Allen Avenue, Ikeja",
      "delivery_address": "45 Admiralty Way, Lekki",
      "price": 3860.00,
      "status": "Delivered",
      "created_at": "2026-02-15T10:30:00.000Z",
      "updated_at": "2026-02-15T18:45:00.000Z"
    },
    {
      "id": 2,
      "tracking_number": "MN-2026-0002",
      "sender_name": "John Doe",
      "receiver_name": "Mike Johnson",
      "pickup_address": "123 Allen Avenue, Ikeja",
      "delivery_address": "12 Admiralty Way, Lekki",
      "price": 2800.00,
      "status": "In Transit",
      "created_at": "2026-02-16T09:15:00.000Z",
      "updated_at": "2026-02-16T11:20:00.000Z"
    }
  ]
}
```

### Public Routes (Rate Limited)

#### Create Order (Protected)

**Description:** Creates a new delivery order and generates a unique tracking number. **Requires authentication** — only logged-in customers can create orders. Validates input, calculates price based on zone and distance, generates tracking number in format `MN-YYYY-####`, and logs first order event. Sender info (name, phone, pickup address) can be omitted if saved in user profile.

```http
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "sender_name": "John Doe",
  "sender_phone": "08012345678",
  "pickup_address": "123 Allen Avenue, Ikeja",
  "receiver_name": "Jane Smith",
  "receiver_phone": "08098765432",
  "delivery_address": "45 Admiralty Way, Lekki",
  "package_description": "Documents",
  "zone_id": 2,
  "distance_km": 15.5
}
```

**Headers:**
- `Authorization` (required): Bearer token obtained from customer signup/login

**Request Fields:**
- `sender_name` (optional): Name of sender — defaults to user's name if not provided
- `sender_phone` (optional): Sender's contact — defaults to user's phone if not provided
- `pickup_address` (optional): Pickup location — defaults to user's default_address if not provided
- `receiver_name` (required): Name of the recipient
- `receiver_phone` (required): Receiver's contact number (min 7 characters)
- `delivery_address` (required): Full delivery destination address (min 5 characters)
- `package_description` (optional): Brief description of package contents
- `zone_id` (optional): Lagos zone ID (1=Mainland, 2=Island, 3=Expanding)
- `distance_km` (optional): Distance in kilometers for price calculation

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "tracking_number": "MN-2026-0001",
    "price": 3860.00
  }
}
```

#### Track Order

**Description:** Retrieves complete order details and event timeline using the tracking number. Returns all order information (sender, receiver, addresses, price, current status) and a chronological list of all status change events. No authentication required — anyone with the tracking number can track the order.

```http
GET /api/track/:trackingNumber
```

**URL Parameters:**
- `trackingNumber` (required): The unique tracking code (e.g., MN-2026-0001)

**Example:**
```http
GET /api/track/MN-2026-0001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tracking_number": "MN-2026-0001",
    "sender_name": "John Doe",
    "sender_phone": "08012345678",
    "pickup_address": "123 Allen Avenue, Ikeja",
    "receiver_name": "Jane Smith",
    "receiver_phone": "08098765432",
    "delivery_address": "45 Admiralty Way, Lekki",
    "package_description": "Documents",
    "price": 3860.00,
    "status": "In Transit",
    "created_at": "2026-02-16T10:30:00.000Z",
    "updated_at": "2026-02-16T12:15:00.000Z",
    "events": [
      {
        "status": "Order Created",
        "note": "Order has been placed successfully.",
        "created_at": "2026-02-16T10:30:00.000Z"
      },
      {
        "status": "Picked Up",
        "note": "Package picked up from sender.",
        "created_at": "2026-02-16T11:00:00.000Z"
      },
      {
        "status": "In Transit",
        "note": "Package is on its way.",
        "created_at": "2026-02-16T12:15:00.000Z"
      }
    ]
  }
}
```

### Admin Routes (Protected)

All admin routes require JWT authentication via Bearer token in the `Authorization` header.

#### Admin Login

**Description:** Authenticates an admin or staff user and returns a JWT token valid for 7 days. Validates email and password, compares password against bcrypt hash stored in database, and generates a signed JWT containing user ID, email, and role. Use the returned token for all subsequent admin API calls.

```http
POST /api/admin/login
Content-Type: application/json

{
  "email": "admin@meenarh.com",
  "password": "admin123"
}
```

**Request Fields:**
- `email` (required): Valid email address of admin/staff user
- `password` (required): User password (minimum 6 characters)

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "name": "Admin User",
      "email": "admin@meenarh.com",
      "role": "admin"
    }
  }
}
```

**Response Fields:**
- `token`: JWT Bearer token (expires in 7 days)
- `user.name`: Display name of authenticated user
- `user.email`: Email address
- `user.role`: User role (`admin` or `staff`)

#### Get All Orders (Admin)

**Description:** Retrieves a list of all orders in the system ordered by creation date (most recent first). Returns order summaries including tracking number, sender/receiver names, addresses, price, current status, and timestamps. Requires admin or staff authentication.

```http
GET /api/admin/orders
Authorization: Bearer <token>
```

**Headers:**
- `Authorization` (required): Bearer token obtained from login

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tracking_number": "MN-2026-0001",
      "sender_name": "John Doe",
      "receiver_name": "Jane Smith",
      "pickup_address": "123 Allen Avenue, Ikeja",
      "delivery_address": "45 Admiralty Way, Lekki",
      "price": 3860.00,
      "status": "In Transit",
      "created_at": "2026-02-16T10:30:00.000Z",
      "updated_at": "2026-02-16T12:15:00.000Z"
    }
  ]
}
```

#### Update Order Status (Admin)

**Description:** Updates the status of an existing order and logs the status change as a new event in the order timeline. The status change is recorded with an optional note and timestamp. Both the order's current status field and the order_events table are updated atomically in a transaction. Requires admin or staff authentication.

```http
PATCH /api/admin/orders/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "Delivered",
  "note": "Package delivered successfully to receiver."
}
```

**URL Parameters:**
- `id` (required): Internal database ID of the order (obtained from GET /api/admin/orders)

**Headers:**
- `Authorization` (required): Bearer token obtained from login

**Request Fields:**
- `status` (required): New status value (must be one of the valid statuses below)
- `note` (optional): Additional information about the status change (e.g., delivery notes, rider comments)

**Valid statuses:**
- `Order Created` — Initial state when order is placed
- `Picked Up` — Package collected from sender
- `In Transit` — Package is being transported
- `Out for Delivery` — Package is with rider for final delivery
- `Delivered` — Package successfully delivered to receiver

**Response:**
```json
{
  "success": true,
  "message": "Order status updated"
}
```

#### List Customers (Admin)

**Description:** Retrieves a list of all registered customers with their profile information and order count. Shows customer name, email, phone, address, registration date, and total number of orders placed. Requires admin or staff authentication.

```http
GET /api/admin/customers
Authorization: Bearer <token>
```

**Headers:**
- `Authorization` (required): Bearer token obtained from admin login

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "08012345678",
      "default_address": "123 Allen Avenue, Ikeja",
      "created_at": "2026-02-15T08:00:00.000Z",
      "order_count": 5
    },
    {
      "id": 2,
      "name": "Jane Smith",
      "email": "jane.smith@example.com",
      "phone": "08098765432",
      "default_address": "45 Admiralty Way, Lekki",
      "created_at": "2026-02-16T09:30:00.000Z",
      "order_count": 2
    }
  ]
}
```

#### Create Admin User (Admin)

**Description:** Creates a new admin or staff user account. Only authenticated admins can create new admin users. Validates input, checks for duplicate email, hashes password with bcrypt, and creates user with specified role (defaults to 'staff' if not specified).

```http
POST /api/admin/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Staff User",
  "email": "staff@meenarh.com",
  "password": "securepass123",
  "role": "staff"
}
```

**Headers:**
- `Authorization` (required): Bearer token obtained from admin login

**Request Fields:**
- `name` (required): Full name (minimum 2 characters)
- `email` (required): Valid email address
- `password` (required): Password (minimum 6 characters)
- `role` (optional): User role — either "admin" or "staff" (defaults to "staff")

**Response:**
```json
{
  "success": true,
  "message": "Admin user created successfully",
  "data": {
    "id": 3,
    "name": "Staff User",
    "email": "staff@meenarh.com",
    "role": "staff"
  }
}
```

#### Get Customer by ID (Admin)

**Description:** Retrieves the full profile of a single customer including their total order count and total amount spent. Requires admin or staff authentication.

```http
GET /api/admin/customers/:id
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` (required): Customer database ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "08012345678",
    "default_address": "123 Allen Avenue, Ikeja",
    "created_at": "2026-02-15T08:00:00.000Z",
    "updated_at": "2026-02-15T08:00:00.000Z",
    "order_count": 5,
    "total_spent": 19300.00
  }
}
```

#### Get Customer Orders (Admin)

**Description:** Retrieves all orders placed by a specific customer, ordered by most recent first. Requires admin or staff authentication.

```http
GET /api/admin/customers/:id/orders
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tracking_number": "MN-2026-0001",
      "receiver_name": "Jane Smith",
      "delivery_address": "45 Admiralty Way, Lekki",
      "price": 3860.00,
      "status": "Delivered",
      "created_at": "2026-02-15T10:30:00.000Z"
    }
  ]
}
```

#### Get Customer Cart (Admin)

**Description:** Retrieves the current cart items for a specific customer. Requires admin or staff authentication.

```http
GET /api/admin/customers/:id/cart
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "receiver_name": "Mike Johnson",
      "delivery_address": "12 Broad Street, Lagos Island",
      "package_description": "Electronics",
      "estimated_price": 2500.00,
      "created_at": "2026-02-26T09:00:00.000Z"
    }
  ]
}
```

---

### Blog API

#### Get Published Posts (Public)

**Description:** Returns all published blog posts ordered by publish date. No authentication required.

```http
GET /api/blog
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "5 Tips for Safe Package Delivery",
      "slug": "5-tips-for-safe-package-delivery",
      "cover_image_url": "https://example.com/image.jpg",
      "author_name": "Admin User",
      "published_at": "2026-02-20T10:00:00.000Z",
      "created_at": "2026-02-20T09:30:00.000Z"
    }
  ]
}
```

#### Get Published Post by Slug (Public)

**Description:** Returns the full content of a single published post by its URL slug. No authentication required.

```http
GET /api/blog/:slug
```

**URL Parameters:**
- `slug` (required): URL-friendly post slug (e.g., `5-tips-for-safe-package-delivery`)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "5 Tips for Safe Package Delivery",
    "slug": "5-tips-for-safe-package-delivery",
    "content": "<h2>Tip 1...</h2><p>...</p>",
    "cover_image_url": "https://example.com/image.jpg",
    "author_name": "Admin User",
    "status": "published",
    "published_at": "2026-02-20T10:00:00.000Z"
  }
}
```

#### List All Posts (Admin)

**Description:** Returns all blog posts (drafts and published) for the admin panel. Requires admin or staff authentication.

```http
GET /api/admin/blog
Authorization: Bearer <token>
```

#### Create Blog Post (Admin)

**Description:** Creates a new blog post. Auto-generates a URL slug from the title. If status is `published`, sets `published_at` to the current timestamp. Requires admin or staff authentication.

```http
POST /api/admin/blog
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "5 Tips for Safe Package Delivery",
  "content": "<h2>Tip 1</h2><p>Always wrap fragile items...</p>",
  "cover_image_url": "https://example.com/image.jpg",
  "status": "published"
}
```

**Request Fields:**
- `title` (required): Post title (minimum 2 characters)
- `content` (required): HTML content from rich text editor (minimum 10 characters)
- `cover_image_url` (optional): Full URL to cover image
- `status` (optional): `draft` or `published` (defaults to `draft`)

**Response:**
```json
{
  "success": true,
  "message": "Blog post created successfully",
  "data": { "id": 1, "slug": "5-tips-for-safe-package-delivery" }
}
```

#### Update Blog Post (Admin)

**Description:** Updates an existing blog post. All fields are optional — only provided fields are updated. If changing status to `published` for the first time, `published_at` is set. Requires admin or staff authentication.

```http
PUT /api/admin/blog/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "status": "published"
}
```

#### Delete Blog Post (Admin)

```http
DELETE /api/admin/blog/:id
Authorization: Bearer <token>
```

---

### Company Settings API

#### Get Settings (Public)

**Description:** Returns current company settings (name, tagline, phone, email, address, whatsapp). Used by the public website footer and contact sections. No authentication required.

```http
GET /api/settings
```

**Response:**
```json
{
  "success": true,
  "data": {
    "company_name": "Meenarh Logistics",
    "tagline": "Fast, trackable deliveries across Lagos.",
    "phone": "08012345678",
    "email": "info@meenarh.com",
    "address": "Lagos, Nigeria",
    "whatsapp": "2348012345678"
  }
}
```

#### Update Settings (Admin)

**Description:** Bulk updates company settings. Accepts any key-value pairs — existing keys are updated, new keys are inserted. Only admin role can update settings. Requires admin authentication.

```http
PUT /api/admin/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "08099999999",
  "whatsapp": "2348099999999",
  "tagline": "Reliable deliveries, every time."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "company_name": "Meenarh Logistics",
    "tagline": "Reliable deliveries, every time.",
    "phone": "08099999999",
    "email": "info@meenarh.com",
    "address": "Lagos, Nigeria",
    "whatsapp": "2348099999999"
  }
}
```

---

### Promo Codes API

#### Validate Promo Code (Public)

**Description:** Validates a promo code against an order total. Checks that the code exists, is active, is not expired, has not exceeded its usage limit, and the order meets the minimum value requirement. Returns the calculated discount without applying it. No authentication required — used at checkout.

```http
POST /api/promo-codes/validate
Content-Type: application/json

{
  "code": "SAVE20",
  "order_total": 5000
}
```

**Request Fields:**
- `code` (required): Promo code string
- `order_total` (required): Current order total in naira (positive number)

**Response (valid):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "promo_code_id": 1,
    "discount_type": "percentage",
    "discount_value": 20,
    "discount": 1000.00,
    "new_total": 4000.00
  }
}
```

**Response (invalid):**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "message": "This promo code has expired"
  }
}
```

#### List Promo Codes (Admin)

```http
GET /api/admin/promo-codes
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "SAVE20",
      "discount_type": "percentage",
      "discount_value": 20.00,
      "min_order_value": 3000.00,
      "max_uses": 100,
      "current_uses": 14,
      "expires_at": "2026-12-31T23:59:59.000Z",
      "is_active": true,
      "created_at": "2026-02-26T10:00:00.000Z"
    }
  ]
}
```

#### Create Promo Code (Admin)

**Description:** Creates a new promo code. `discount_type` must be `percentage` or `fixed`. Leave `max_uses` and `expires_at` as `null` for unlimited/no-expiry. Requires admin or staff authentication.

```http
POST /api/admin/promo-codes
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "SAVE20",
  "discount_type": "percentage",
  "discount_value": 20,
  "min_order_value": 3000,
  "max_uses": 100,
  "expires_at": "2026-12-31T23:59:59.000Z"
}
```

**Request Fields:**
- `code` (required): Unique promo code string (min 3 characters, auto-uppercased)
- `discount_type` (required): `percentage` or `fixed`
- `discount_value` (required): Percentage (e.g., `20` for 20%) or fixed amount in naira
- `min_order_value` (optional): Minimum order total required to use the code
- `max_uses` (optional): Maximum number of times the code can be used (null = unlimited)
- `expires_at` (optional): ISO datetime string for expiry (null = never expires)

**Response:**
```json
{
  "success": true,
  "message": "Promo code created successfully",
  "data": { "id": 1, "code": "SAVE20" }
}
```

#### Update Promo Code (Admin)

```http
PUT /api/admin/promo-codes/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "discount_value": 25,
  "expires_at": "2027-01-31T23:59:59.000Z"
}
```

#### Toggle Promo Code Active/Inactive (Admin)

**Description:** Toggles the `is_active` flag without deleting the code. Returns the new active state.

```http
PATCH /api/admin/promo-codes/:id/toggle
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Promo code deactivated",
  "data": { "is_active": false }
}
```

#### Get Promo Code Detail with Usage (Admin)

**Description:** Returns full promo code details plus a list of every customer who used it, which order it was applied to, and how much discount was given.

```http
GET /api/admin/promo-codes/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "SAVE20",
    "discount_type": "percentage",
    "discount_value": 20.00,
    "current_uses": 14,
    "usage": [
      {
        "id": 1,
        "customer_name": "John Doe",
        "customer_email": "john@example.com",
        "tracking_number": "MN-2026-0042",
        "discount_applied": 1000.00,
        "used_at": "2026-02-20T14:30:00.000Z"
      }
    ]
  }
}
```

#### Delete Promo Code (Admin)

```http
DELETE /api/admin/promo-codes/:id
Authorization: Bearer <token>
```

---

### Analytics API

#### Track Event (Public)

**Description:** Records a frontend analytics event (page view, order created, or signup). Rate-limited. Silently fails on the client — does not affect user experience.

```http
POST /api/analytics/track
Content-Type: application/json

{
  "event_type": "page_view",
  "page_url": "/",
  "session_id": "1740571234-abc123xyz"
}
```

**Request Fields:**
- `event_type` (required): `page_view`, `order_created`, or `signup`
- `page_url` (optional): URL of the page being viewed
- `session_id` (optional): Client-side session identifier for unique visitor counting

#### Analytics Overview (Admin)

**Description:** Returns visitor, order, revenue, and signup counts for a date range plus the calculated conversion rate. Defaults to the last 30 days if no dates provided.

```http
GET /api/admin/analytics/overview?start_date=2026-02-01&end_date=2026-02-28
Authorization: Bearer <token>
```

**Query Parameters:**
- `start_date` (optional): ISO date string — defaults to 30 days ago
- `end_date` (optional): ISO date string — defaults to today

**Response:**
```json
{
  "success": true,
  "data": {
    "total_visitors": 1240,
    "total_orders": 87,
    "total_revenue": 335820.00,
    "total_signups": 43,
    "conversion_rate": 7.02
  }
}
```

#### Analytics Trends (Admin)

**Description:** Returns daily visitor and order counts for charting. Useful for visualising trends over time.

```http
GET /api/admin/analytics/trends?start_date=2026-02-01&end_date=2026-02-28
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "visitors": [
      { "date": "2026-02-01", "visitors": 42 },
      { "date": "2026-02-02", "visitors": 38 }
    ],
    "orders": [
      { "date": "2026-02-01", "orders": 3, "revenue": 11580.00 }
    ]
  }
}
```

#### Analytics Locations (Admin)

**Description:** Returns the most frequently requested pickup and delivery locations aggregated from all orders.

```http
GET /api/admin/analytics/locations?limit=10
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of top locations to return (default `10`, max `100`)

**Response:**
```json
{
  "success": true,
  "data": {
    "pickup_locations": [
      { "location": "123 Allen Avenue, Ikeja", "request_count": 28 }
    ],
    "delivery_locations": [
      { "location": "45 Admiralty Way, Lekki", "request_count": 19 }
    ]
  }
}
```

---

## Tracking Number Format

Format: `MN-<YEAR>-<4-digit padded order ID>`

Examples:
- `MN-2026-0001`
- `MN-2026-0042`
- `MN-2026-1234`

## Security Features

- ✅ **Password Hashing:** bcrypt with salt rounds
- ✅ **JWT Authentication:** 7-day token expiry
- ✅ **Role-Based Access:** admin/staff roles enforced
- ✅ **Prepared Statements:** All SQL queries parameterized (no SQL injection)
- ✅ **Rate Limiting:** 400 requests per 15 minutes per IP on public routes in production (5000 in development); cart and other authenticated API paths are not counted against this bucket
- ✅ **Input Validation:** Zod schemas reject invalid/malicious input
- ✅ **No Sensitive Data Exposure:** Password hashes never returned in responses
- ✅ **No Internal IDs Exposed:** Public tracking uses tracking_number only
- ✅ **Production Mode:** Stack traces hidden when `NODE_ENV=production`

## Deployment Notes (Hostinger Managed Web Apps)

1. **No Docker Required:** Standard Node.js app
2. **No Redis Required:** Rate limiting uses memory store (suitable for single-instance deployment)
3. **No Microservices:** Monolithic Express app for simplicity
4. **Connection Pooling:** MySQL pool limited to 5 connections (cloud-friendly)
5. **Environment Variables:** Use Hostinger's environment variable management
6. **Database:** Use provided MySQL database (apply `schema.sql` via phpMyAdmin or CLI)

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description here"
}
```

In development mode, errors also include a `stack` field for debugging.

## License

ISC
