# NOVA DIGITAL — Real Store v4

## What is fixed
- Admin login is now tied to the NOVA DIGITAL owner email.
- A reset command is included if the password/database ever gets out of sync.
- Product upload, stock, price, old price, orders, COD checkout, delivery fee, tracking and order status are included.
- Storefront and Seller Center were redesigned for a more professional marketplace feel.

## Run on Windows
1. Extract the ZIP.
2. Open `backend` folder.
3. Click File Explorer address bar, type `cmd`, press Enter.
4. Run:
   npm install
5. If this is your first v4 run, reset/confirm the admin login:
   npm run reset-admin
6. Run:
   npm start
7. Store: http://localhost:3000
8. Seller Center: http://localhost:3000/admin/

## Admin login (local development)
Email: mudassir239200@gmail.com
Password: Nova@12345

After login, go to Settings and change the password.

## Delivery
Current rule:
- Rs. 1,500+ = FREE
- Below Rs. 1,500 = Rs. 250

The store saves customer address/city/province and order amount. Courier API booking is intentionally NOT faked. To make courier booking automatic, get official API credentials from your courier and connect a server-side courier adapter. Never put courier API keys in frontend JS.

## Before public launch
- Set a strong JWT_SECRET environment variable.
- Set ADMIN_EMAIL / ADMIN_PASSWORD environment variables or change password inside Seller Center.
- Move SQLite + uploaded images to persistent storage or use a hosted database/object storage provider.
- Use HTTPS and a real domain.


## v4.2 login UI fix
This build fixes the Seller Center login transition and keeps the dashboard open even if one dashboard data request fails. It also creates the database folder automatically during admin reset.


## v4.2 update
- Customer email is required at checkout and saved with every order.
- Orders remain stored in SQLite until you intentionally remove the database.
- Seller Center shows customer email and can download all orders as CSV for backup/Excel.
