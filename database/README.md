# SmartMove Transport Solutions - Database Implementation

**Module:** Data Management 2 (DM2)  
**Course:** Higher National Diploma in Software Engineering (HDSE) / Higher National Diploma in Information Systems (HNDIS)  
**Institution:** National Institute of Business Management (NIBM)

---

## 👥 Student Information

| Student Name    | Student ID      | Specialization       |
| :-------------- | :-------------- | :------------------- |
| **Dilukshan N** | COHNDSE261F-002 | Software Engineering |
| **Shaveen G W** | COHNDIS261F-017 | Information Systems  |

---

## 📌 Project Overview

**SmartMove Transport Solutions** is a centralized transportation management platform managing vehicle operations, driver assignments, passenger bookings, route planning, trip scheduling, ticket reservations, payments, vehicle maintenance, and customer feedback.

To fulfill the requirements of Data Management 2, the system uses a **hybrid database architecture**:

1. **Oracle Database XE 21c (Relational Database):** Handles all core transactional business operations, ACID transactions, relational integrity, seat reservations, payments, and PL/SQL business logic.
2. **MongoDB (NoSQL Database):** Handles semi-structured and unstructured data, including passenger reviews, sentiment ratings, customer complaints, travel announcements, and multimedia asset metadata.

---

## 🗄️ Database Architecture & Schemas

### 1. Oracle Relational Database (13 Tables)

The schema is normalized to **Third Normal Form (3NF)** and directly maps to the 9 core business domains required in the coursework brief:

| Table Name               | Primary Key      | Description & Foreign Keys                                                                          |
| :----------------------- | :--------------- | :-------------------------------------------------------------------------------------------------- |
| `app_users`              | `user_id`        | User credentials, hashed passwords, and system roles (`ADMIN`, `STAFF`, `PASSENGER`).               |
| `passengers`             | `passenger_id`   | Passenger personal details, linked to `app_users(user_id)`.                                         |
| `drivers`                | `driver_id`      | Driver records, contact details, and unique license numbers.                                        |
| `vehicles`               | `vehicle_id`     | Fleet records, registration numbers, vehicle types, capacity, and status (`ACTIVE`, `MAINTENANCE`). |
| `routes`                 | `route_id`       | Travel routes, origin, destination, and base fares.                                                 |
| `trips`                  | `trip_id`        | Scheduled trips with assigned route, vehicle, driver, departure/arrival timestamps, and fares.      |
| `bookings`               | `booking_id`     | Booking records for passengers on specific trips (`PENDING`, `CONFIRMED`, `CANCELLED`).             |
| `tickets`                | `ticket_id`      | Individual seat tickets per booking (`RESERVED`, `ISSUED`, `CANCELLED`).                            |
| `payments`               | `payment_id`     | Payment records linked 1-to-1 with confirmed bookings (`CASH`, `CARD`, `BANK_TRANSFER`).            |
| `refunds`                | `refund_id`      | Full refunds recorded for cancelled paid bookings.                                                  |
| `maintenance_records`    | `maintenance_id` | Scheduled and completed vehicle servicing logs and costs.                                           |
| `feedback_records`       | `feedback_id`    | Relational reference for reviews and complaints linked to completed bookings.                       |
| `booking_status_history` | -                | Audit log capturing all booking status transitions with timestamps.                                 |

Website authentication uses signed tokens in browser localStorage. Oracle keeps these 13 core tables; there are no extra session or notification-configuration tables. Login views/procedures remain. The notification cutoff lives in server-only website configuration. See the [website migration guide](../website/README.md#browser-authentication-and-existing-installations) for existing installations and support-table backups.

#### Database Trigger:

- **`trg_booking_status_history`**: Automatically captures any update to `bookings.status` and logs `old_status`, `new_status`, and `changed_at` into `booking_status_history`.

---

## ⚙️ PL/SQL Implementation

The business logic is implemented directly inside Oracle Database using PL/SQL stored procedures, functions, explicit cursors, and custom exception handling.

### Core Business Procedures & Functions:

1. **`schedule_trip`**: Validates driver, vehicle, and maintenance schedule conflicts before inserting a trip.
2. **`create_booking`**: Creates a new booking header after verifying that the trip is scheduled and has not departed.
3. **`reserve_seat`**: Reserves an individual seat on a vehicle, ensuring seat numbers are within vehicle capacity and not already booked.
4. **`available_seats(p_trip_id)` (Function)**: Calculates remaining available seats for a given trip (`total_seats - booked_seats`).
5. **`record_payment`**: Validates payment amount against total reserved ticket fare, marks tickets as `ISSUED`, and updates booking to `CONFIRMED`.
6. **`cancel_booking`**: Cancels an un-departed booking and releases reserved/issued seats.
7. **`process_refund`**: Records full refund for a cancelled paid booking.
8. **Fleet & Master Data CRUD Procedures**: Clean stored procedures for inserting, updating, and deleting vehicles, drivers, routes, and maintenance records (`add_vehicle`, `add_driver`, `add_route`, `schedule_maintenance`, etc.).

---

## 📊 The 5 Business Reports (PL/SQL)

The coursework requires at least 5 business reports implemented using PL/SQL cursors, joins, and aggregates:

```sql
-- To view report output in Oracle SQL Developer / SQL*Plus:
SET SERVEROUTPUT ON;
```

### Report 1: Most Frequently Used Routes

- **Procedure:** `popular_routes`
- **Purpose:** Identifies top routes ranked by total tickets issued using a cursor with `JOIN` and `COUNT` aggregate.
- **Execution:**
  ```sql
  EXEC popular_routes;
  ```

### Report 2: Total Revenue & Net Earnings

- **Procedure:** `revenue`
- **Purpose:** Computes total payments collected, total refunds issued, and net company revenue.
- **Execution:**
  ```sql
  EXEC revenue;
  ```

### Report 3: Passenger Travel History

- **Procedure:** `passenger_history(p_passenger_id)`
- **Purpose:** Displays detailed travel history, seat numbers, and booking statuses for a given passenger.
- **Execution:**
  ```sql
  EXEC passenger_history(1);
  ```

### Report 4: Vehicles Due for Maintenance

- **Procedure:** `maintenance_due(p_as_of)`
- **Purpose:** Lists all vehicles with scheduled maintenance due on or before a specified date.
- **Execution:**
  ```sql
  EXEC maintenance_due(SYSDATE);
  ```

### Report 5: Trip Occupancy & Utilization

- **Procedure:** `trip_occupancy`
- **Purpose:** Calculates passenger occupancy percentage for each scheduled trip against vehicle capacity.
- **Execution:**
  ```sql
  EXEC trip_occupancy;
  ```

---

## 🍃 MongoDB Integration (NoSQL)

MongoDB acts as a complementary database for unstructured and multimedia content:

### Collections:

- `feedback_content`: Customer reviews, ratings (1–5 scale), comments, keywords, and staff responses.
- `vehicle_assets`: Vehicle documents, such as registration PDFs.
- `trip_media`: Trip and vehicle photos, with uploaded WebP bytes and metadata in the same document. Photos link through `tripId` or `vehicleId`; no separate GridFS collections are used.
- `announcements`: Dynamic travel notices and alerts.
- `notifications`: Passenger in-app alerts and notifications.

### Demonstrated MongoDB Queries (`database/mongodb/queries.js`):

1. **Retrieve all passenger reviews for a specific route:**
   ```javascript
   db.feedback_content.find({ routeId: "1" });
   ```
2. **Identify highest-rated vehicles using aggregation:**
   ```javascript
   db.feedback_content.aggregate([
     {
       $group: { _id: "$vehicleId", averageRating: { $avg: "$vehicleRating" } },
     },
     { $sort: { averageRating: -1 } },
   ]);
   ```
3. **Identify highest-rated drivers using aggregation:**
   ```javascript
   db.feedback_content.aggregate([
     { $group: { _id: "$driverId", averageRating: { $avg: "$driverRating" } } },
     { $sort: { averageRating: -1 } },
   ]);
   ```
4. **Search feedback/complaints using specific keywords:**
   ```javascript
   db.feedback_content.find({ keywords: { $in: ["late", "delay"] } });
   ```
5. **Retrieve vehicle documents and media:**
   ```javascript
   db.vehicle_assets.find({ vehicleId: "1" });
   ```

---

## 🚀 Setup & Execution Guide

### Oracle Database Setup (Oracle SQL Developer)

Open Oracle SQL Developer, connect to your Pluggable Database (e.g., `XEPDB1`), and execute the scripts in order:

| Step  | Script File                           | Purpose                                                                                                                  |
| :---: | :------------------------------------ | :----------------------------------------------------------------------------------------------------------------------- |
| **1** | `oracle/01_users.sql`                 | Creates schema owner (`smartmove_database`) and app user (`smartmove_database_app`) with least-privilege security roles. |
| **2** | `oracle/02_schema.sql`                | Creates all 13 relational tables, constraints, foreign keys, and the audit trigger.                                      |
| **3** | `oracle/03_business_logic.sql`        | Compiles core PL/SQL procedures for trips, bookings, payments, and seat reservations.                                    |
| **4** | `oracle/03_management_operations.sql` | Compiles management CRUD procedures for vehicles, drivers, routes, and maintenance.                                      |
| **5** | `oracle/03_trip_operations.sql`       | Compiles trip lifecycle procedures (reschedule, cancel, complete).                                                       |
| **6** | `oracle/04_reports.sql`               | Compiles the 5 PL/SQL business reports.                                                                                  |
| **7** | `oracle/05_sample_data.sql`           | Inserts realistic sample data for vehicles, drivers, routes, trips, and bookings.                                        |
| **8** | `oracle/06_permissions.sql`           | Grants execution permissions and views to `smartmove_database_app`.                                                      |

_(Optional Practice Walkthroughs: `07_basic_operations.sql` and `08_booking_example.sql` demonstrate sample operations with rollback)._

### MongoDB Setup (MongoDB Shell / Compass)

1. Open **MongoDB Compass** or terminal `mongosh`.
2. Connect to `mongodb://localhost:27017`.
3. Switch to the `smartmove` database:
   ```javascript
   use smartmove;
   ```
4. Run the seed script:
   ```javascript
   load("database/mongodb/setup.js");
   ```
5. Test the queries:
   ```javascript
   load("database/mongodb/queries.js");
   ```
