CREATE TABLE app_users (
    user_id NUMBER PRIMARY KEY,
    email VARCHAR2(100) NOT NULL UNIQUE,
    password_hash VARCHAR2(255) NOT NULL,
    role VARCHAR2(12) CHECK (role IN ('ADMIN', 'STAFF', 'PASSENGER'))
);

CREATE TABLE passengers (
    passenger_id NUMBER PRIMARY KEY,
    user_id NUMBER NOT NULL UNIQUE REFERENCES app_users(user_id),
    full_name VARCHAR2(100) NOT NULL,
    phone VARCHAR2(15) NOT NULL
);

CREATE TABLE drivers (
    driver_id NUMBER PRIMARY KEY,
    full_name VARCHAR2(100) NOT NULL,
    phone VARCHAR2(15),
    licence_number VARCHAR2(30) NOT NULL UNIQUE
);

CREATE TABLE vehicles (
    vehicle_id NUMBER PRIMARY KEY,
    registration_number VARCHAR2(20) NOT NULL UNIQUE,
    vehicle_type VARCHAR2(20),
    seat_count NUMBER(3) NOT NULL CHECK (seat_count > 0),
    status VARCHAR2(15) DEFAULT 'ACTIVE' NOT NULL
        CHECK (status IN ('ACTIVE', 'MAINTENANCE'))
);

CREATE TABLE routes (
    route_id NUMBER PRIMARY KEY,
    route_name VARCHAR2(100) NOT NULL,
    origin VARCHAR2(50) NOT NULL,
    destination VARCHAR2(50) NOT NULL,
    base_fare NUMBER(10, 2) NOT NULL CHECK (base_fare > 0)
);

CREATE TABLE trips (
    trip_id NUMBER PRIMARY KEY,
    route_id NUMBER NOT NULL REFERENCES routes(route_id),
    vehicle_id NUMBER NOT NULL REFERENCES vehicles(vehicle_id),
    driver_id NUMBER NOT NULL REFERENCES drivers(driver_id),
    departure_at DATE NOT NULL,
    arrival_at DATE NOT NULL,
    fare NUMBER(10, 2) NOT NULL CHECK (fare > 0),
    status VARCHAR2(12) DEFAULT 'SCHEDULED' NOT NULL
        CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
    CHECK (arrival_at > departure_at)
);

CREATE TABLE bookings (
    booking_id NUMBER PRIMARY KEY,
    passenger_id NUMBER NOT NULL REFERENCES passengers(passenger_id),
    trip_id NUMBER NOT NULL REFERENCES trips(trip_id),
    booked_at DATE DEFAULT SYSDATE NOT NULL,
    status VARCHAR2(12) DEFAULT 'PENDING' NOT NULL
        CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED'))
);

CREATE TABLE tickets (
    ticket_id NUMBER PRIMARY KEY,
    booking_id NUMBER NOT NULL REFERENCES bookings(booking_id),
    seat_number NUMBER(3) NOT NULL CHECK (seat_number > 0),
    fare_amount NUMBER(10, 2) NOT NULL CHECK (fare_amount > 0),
    status VARCHAR2(12) DEFAULT 'RESERVED' NOT NULL
        CHECK (status IN ('RESERVED', 'ISSUED', 'CANCELLED'))
);

CREATE TABLE payments (
    payment_id NUMBER PRIMARY KEY,
    booking_id NUMBER NOT NULL UNIQUE REFERENCES bookings(booking_id),
    amount NUMBER(10, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR2(15) NOT NULL
        CHECK (payment_method IN ('CASH', 'CARD', 'BANK_TRANSFER')),
    paid_at DATE DEFAULT SYSDATE NOT NULL
);

CREATE TABLE refunds (
    refund_id NUMBER PRIMARY KEY,
    payment_id NUMBER NOT NULL UNIQUE REFERENCES payments(payment_id),
    amount NUMBER(10, 2) NOT NULL CHECK (amount > 0),
    reason VARCHAR2(200) NOT NULL,
    refunded_at DATE DEFAULT SYSDATE NOT NULL
);

CREATE TABLE maintenance_records (
    maintenance_id NUMBER PRIMARY KEY,
    vehicle_id NUMBER NOT NULL REFERENCES vehicles(vehicle_id),
    maintenance_type VARCHAR2(100) NOT NULL,
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    cost NUMBER(10, 2) CHECK (cost >= 0),
    status VARCHAR2(12) DEFAULT 'SCHEDULED' NOT NULL
        CHECK (status IN ('SCHEDULED', 'COMPLETED'))
);

CREATE TABLE feedback_records (
    feedback_id NUMBER PRIMARY KEY,
    booking_id NUMBER NOT NULL REFERENCES bookings(booking_id),
    feedback_type VARCHAR2(12) NOT NULL
        CHECK (feedback_type IN ('REVIEW', 'COMPLAINT')),
    status VARCHAR2(12) DEFAULT 'OPEN' NOT NULL
        CHECK (status IN ('OPEN', 'RESOLVED'))
);

CREATE TABLE booking_status_history (
    booking_id NUMBER NOT NULL REFERENCES bookings(booking_id),
    old_status VARCHAR2(12),
    new_status VARCHAR2(12),
    changed_at DATE DEFAULT SYSDATE NOT NULL
);

CREATE OR REPLACE TRIGGER trg_booking_status_history
AFTER UPDATE OF status ON bookings
FOR EACH ROW
BEGIN
    IF :OLD.status <> :NEW.status THEN
        INSERT INTO booking_status_history (booking_id, old_status, new_status)
        VALUES (:NEW.booking_id, :OLD.status, :NEW.status);
    END IF;
END;
/
