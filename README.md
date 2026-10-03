# SmartMove Transport Solutions

**Module:** Data Management 2 (DM2)  
**Programme:** Higher National Diploma in Software Engineering (HDSE) / Higher National Diploma in Information Systems (HNDIS)  
**Institution:** National Institute of Business Management (NIBM)

---

## 👥 Project Team

| Student Name    | Student ID      | Specialization       |
| :-------------- | :-------------- | :------------------- |
| **Dilukshan N** | COHNDSE261F-002 | Software Engineering |
| **Shaveen G W** | COHNDIS261F-017 | Information Systems  |

---

## 📖 Project Overview

**SmartMove Transport Solutions** is a centralized transportation management and digital ticket booking system developed for transport service providers operating buses, vans, and passenger vehicles. The platform improves transport scheduling, route planning, fleet management, and passenger ticket reservations.

The project demonstrates a **hybrid database solution** integrating:

1. **Oracle Database (Relational):** Manages structured operational records (vehicles, drivers, routes, trips, bookings, tickets, payments, refunds, and maintenance) with strict ACID transactions, stored procedures, audit triggers, and PL/SQL business reports.
2. **MongoDB (NoSQL):** Manages flexible and unstructured content including passenger reviews, sentiment ratings, customer complaints, travel announcements, and multimedia asset links.
3. **Web Application:** A responsive web application built with Next.js and TypeScript connecting passengers and administrators to the database operations.

---

## 🎯 Key System Features

### Passenger Portal

- **Account Registration & Login:** Secure authentication for daily commuters.
- **Trip Search:** Search scheduled trips by origin, destination, and travel date with real-time seat availability.
- **Seat Reservation:** Interactive multi-seat selection with temporary reservation holds.
- **Ticket & Booking Management:** View booking confirmations, issued tickets, and cancel bookings prior to departure.
- **Reviews & Feedback:** Submit route reviews, star ratings, and complaints (stored in MongoDB).
- **Notifications & Alerts:** View travel announcements and trip updates.

### Administrator Workspace

- **Fleet Management:** Add, update, and manage vehicle details, capacity, and active status.
- **Driver Management:** Maintain driver profiles and license details.
- **Route & Trip Scheduling:** Plan routes, set base fares, schedule trips, and assign vehicles and drivers without scheduling conflicts.
- **Payment Processing:** Record verified passenger payments and issue tickets.
- **Refund Management:** Process full refunds on cancelled trips/bookings.
- **Maintenance Tracking:** Schedule and log vehicle servicing costs and completion dates.
- **Customer Feedback Moderation:** Review customer ratings and feedback stored in MongoDB.

---

## 🛠️ Technology Stack

| Layer                   | Technology                               | Purpose                                                              |
| :---------------------- | :--------------------------------------- | :------------------------------------------------------------------- |
| **Frontend & Backend**  | Next.js 16, React 19, TypeScript         | Full-stack application, UI components, and API routes                |
| **Styling**             | Tailwind CSS v4, shadcn UI, Lucide Icons | Clean, responsive user interface                                     |
| **Relational Database** | Oracle Database XE 21c, SQL, PL/SQL      | Core transactional storage, stored procedures, triggers, and reports |
| **NoSQL Database**      | MongoDB                                  | Dynamic reviews, ratings, announcements, and media references        |
| **Database Drivers**    | `oracledb` (Node.js) & `mongodb`         | Native connection drivers for server-side operations                 |

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js** (v20 or v22 LTS recommended) and **npm**
- **Oracle Database XE 21c** with pluggable database `XEPDB1` running locally
- **MongoDB Community Server** (v7+) running on `localhost:27017`

### 2. Database Setup

1. Follow the step-by-step instructions in the [Database Guide](database/README.md) to set up Oracle tables, PL/SQL procedures, and sample data.
2. In MongoDB Compass or `mongosh`, execute `database/database/mongodb/setup.js` in the `smartmove` database.

### 3. Environment Configuration

Create a `.env.local` file inside the `website/` directory with your local credentials:

```dotenv
ORACLE_USER=SMARTMOVE_DATABASE_APP
ORACLE_PASSWORD=your_app_password
ORACLE_CONNECT_STRING=localhost:1521/XEPDB1

MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=smartmove
```

### 4. Running the Web Application

Open your terminal in the `website/` directory:

```bash
cd website
npm install
npm run dev
```

Open your browser and navigate to: **`http://localhost:3000`**

---

## 🔑 Demo Login Accounts

| Role              | Email                      | Access Route |
| :---------------- | :------------------------- | :----------- |
| **Administrator** | `admin@smartmove.test`     | `/admin`     |
| **Passenger**     | `passenger@smartmove.test` | `/dashboard` |

_(Passcodes and demo records can be generated or checked via the local credentials file in `website/.env.demo.local`)._
