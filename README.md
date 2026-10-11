# SmartMove

SmartMove is a transport management and ticket booking system built for the **Data Management 2 (DM2)** module at **NIBM**.

## Team

| Name | Student ID | Specialization |
| --- | --- | --- |
| Dilukshan N | COHNDSE261F-002 | Software Engineering |
| Shaveen G W | COHNDIS261F-017 | Information Systems |

## Features

- **Passengers:** Sign up, search trips, reserve seats, manage bookings and tickets, submit feedback, and view notifications.
- **Admins:** Manage vehicles, drivers, routes, trips, payments, refunds, maintenance, and feedback.
- **Reports:** Popular routes, revenue, passenger history, maintenance due, and trip occupancy.

## Technologies

- **Website:** Next.js, React, TypeScript, Tailwind CSS, and shadcn UI.
- **Oracle SQL / PL/SQL:** Transport records, bookings, payments, and reports.
- **MongoDB:** Reviews, announcements, notifications, and media.

## Setup

Requires Node.js and npm, Oracle Database XE, and MongoDB.

1. Follow the [database setup guide](database/README.md).
2. Run `database/database/mongodb/setup.js` in MongoDB using `mongosh` or Compass.
3. Create `website/.env.local` with your database settings:

```dotenv
ORACLE_USER=SMARTMOVE_DATABASE_APP
ORACLE_PASSWORD=your_app_password
ORACLE_CONNECT_STRING=localhost:1521/XEPDB1
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=smartmove
```

4. Install dependencies and start the website:

```bash
cd website
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Demo Accounts

| Role | Email | Page |
| --- | --- | --- |
| Admin | admin@smartmove.test | `/admin` |
| Passenger | passenger@smartmove.test | `/dashboard` |

Check the local `website/.env.demo.local` file for demo passwords.
