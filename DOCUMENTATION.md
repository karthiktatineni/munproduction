# IARE MUN 2026 - Deep Technical Documentation

This documentation explains the internal logic, security protocols, and operational workflows of the IARE MUN Platform.

## 1. Backend Logic & Controller Workflows

### 💳 Payment Controller (`paymentController.js`)
The payment logic is the most critical part of the system. It handles dynamic price calculation based on:
- **Registration Type**: Different base prices for School, Internal, and External.
- **Year of Study**: Specific logic to target 1st-year students with promotional pricing.
- **Group Discounts**: Automated calculation based on `groupSize`.

**Security Logic:**
- **UTR Validation**: Before a payment is accepted, the server performs a **Dual-Collection Check**. It queries both `registrations` and `oc_registrations` to ensure the 12-digit UTR has not been used before.
- **Atomicity**: The system updates the `amountToPay` in Firestore just before generating the payment summary to ensure users always pay the most current price.

### 📊 Admin Controller (`adminController.js`)
The Admin panel is optimized for high-frequency access:
- **In-Memory Caching**: A JS-level `cache` object stores delegate and OC lists for 30 seconds.
- **Automatic Invalidation**: Whenever an admin performs a verify, allocate, or deallocate action, the cache is instantly cleared (`clearCache()`).

## 2. Infrastructure & Devops

### The NGINX Load Balancer (`nginx.conf`)
The NGINX layer is configured for **Production Resilience**:
```nginx
upstream backend_servers {
    least_conn; # Routes traffic to the server with fewest active connections
    server productionbackend-3sr4.onrender.com:443;
    server productionbackend-o3tk.onrender.com:443;
}
```
- **SNI Fix**: Since we target Render URLs, `proxy_ssl_server_name on` is enabled to pass the correct SSL hostname during the handshake.
- **Fault Tolerance**: `proxy_next_upstream` is configured. If one server returns a `502` or `504` (often during a Render sleep/wake cycle), Nginx instantly retries the second server.

### Relative API Pathing
The project uses a **zero-configuration environment**. In `App.jsx`, the API URL is set to `/api`.
- In **Vercel**: Routes are handled by `vercel.json` rewrites.
- In **Docker**: Routes are handled by the NGINX `location /api` block.
This allows the same code to run on a local developer machine, a Docker container, and a Vercel production deployment without modification.

## 3. Database Schema

### `registrations` (Firestore)
```json
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "9876543210",
  "college": "College Name",
  "yearOfStudy": "1st Year / 2nd Year...",
  "registrationType": "Local/External...",
  "preferences": [
    { "committee": "UNSC", "countries": ["China", "France"] }
  ],
  "utr": "123456789012",
  "verified": false,
  "allocation": { "committee": "UNSC", "country": "China" },
  "isGroup": false,
  "refId": "MUNIARE123456789",
  "createdAt": "Timestamp"
}
```

## 4. UI/UX Principles
- **Glassmorphism**: Applied to all registration cards for a premium feel.
- **Visual Feedback**: Buttons transition to "Processing..." states during API calls to prevent double submissions.
- **Dark Mode Optimization**: Deep blues and purples (#020617) used to reduce eye strain and emphasize the "Diplomatic" aesthetic.

---
*Documentation last updated: February 2026*
