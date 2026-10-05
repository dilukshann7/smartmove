SET SERVEROUTPUT ON;

CREATE OR REPLACE PROCEDURE add_vehicle (
    p_id IN NUMBER,
    p_registration IN VARCHAR2,
    p_type IN VARCHAR2,
    p_seats IN NUMBER
)
AS
BEGIN
    IF p_seats <> TRUNC(p_seats) THEN
        RAISE VALUE_ERROR;
    END IF;

    INSERT INTO vehicles (vehicle_id, registration_number, vehicle_type, seat_count)
    VALUES (p_id, p_registration, p_type, p_seats);
END add_vehicle;
/

CREATE OR REPLACE PROCEDURE update_vehicle (
    p_id IN NUMBER,
    p_registration IN VARCHAR2,
    p_type IN VARCHAR2,
    p_seats IN NUMBER,
    p_status IN VARCHAR2
)
AS
    old_seats NUMBER;
    trip_count NUMBER;
    invalid_vehicle EXCEPTION;
BEGIN
    SELECT seat_count
    INTO old_seats
    FROM vehicles
    WHERE vehicle_id = p_id;

    SELECT COUNT(*)
    INTO trip_count
    FROM trips
    WHERE vehicle_id = p_id;

    IF p_seats <> TRUNC(p_seats) OR (p_seats <> old_seats AND trip_count > 0) THEN
        RAISE invalid_vehicle;
    END IF;

    SELECT COUNT(*)
    INTO trip_count
    FROM trips
    WHERE vehicle_id = p_id
      AND status = 'SCHEDULED';

    IF p_status = 'MAINTENANCE' AND trip_count > 0 THEN
        RAISE invalid_vehicle;
    END IF;

    UPDATE vehicles
    SET registration_number = p_registration,
        vehicle_type = p_type,
        seat_count = p_seats,
        status = p_status
    WHERE vehicle_id = p_id;
EXCEPTION
    WHEN invalid_vehicle THEN
        DBMS_OUTPUT.PUT_LINE('Use whole seats; keep used capacity; cancel scheduled trips before maintenance.');
        RAISE;
END update_vehicle;
/

CREATE OR REPLACE PROCEDURE add_driver (
    p_id IN NUMBER,
    p_name IN VARCHAR2,
    p_phone IN VARCHAR2,
    p_licence IN VARCHAR2
)
AS
BEGIN
    INSERT INTO drivers VALUES (p_id, p_name, p_phone, p_licence);
END add_driver;
/

CREATE OR REPLACE PROCEDURE update_driver (
    p_id IN NUMBER,
    p_name IN VARCHAR2,
    p_phone IN VARCHAR2,
    p_licence IN VARCHAR2
)
AS
BEGIN
    UPDATE drivers
    SET full_name = p_name,
        phone = p_phone,
        licence_number = p_licence
    WHERE driver_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END update_driver;
/

CREATE OR REPLACE PROCEDURE add_route (
    p_id IN NUMBER,
    p_name IN VARCHAR2,
    p_origin IN VARCHAR2,
    p_destination IN VARCHAR2,
    p_fare IN NUMBER
)
AS
BEGIN
    IF UPPER(TRIM(p_origin)) = UPPER(TRIM(p_destination)) THEN
        RAISE VALUE_ERROR;
    END IF;

    INSERT INTO routes VALUES (p_id, p_name, p_origin, p_destination, p_fare);
END add_route;
/

CREATE OR REPLACE PROCEDURE update_route (
    p_id IN NUMBER,
    p_name IN VARCHAR2,
    p_fare IN NUMBER
)
AS
BEGIN
    UPDATE routes
    SET route_name = p_name,
        base_fare = p_fare
    WHERE route_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
    -- Existing trip and ticket fares stay unchanged.
END update_route;
/

CREATE OR REPLACE PROCEDURE add_app_user (
    p_id IN NUMBER,
    p_email IN VARCHAR2,
    p_hash IN VARCHAR2,
    p_role IN VARCHAR2
)
AS
BEGIN
    IF p_role IS NULL THEN
        RAISE VALUE_ERROR;
    END IF;

    INSERT INTO app_users VALUES (p_id, LOWER(TRIM(p_email)), p_hash, p_role);
END add_app_user;
/

CREATE OR REPLACE PROCEDURE update_app_user (
    p_id IN NUMBER,
    p_email IN VARCHAR2,
    p_role IN VARCHAR2
)
AS
    profiles NUMBER;
    invalid_role EXCEPTION;
BEGIN
    SELECT COUNT(*)
    INTO profiles
    FROM passengers
    WHERE user_id = p_id;

    IF p_role IS NULL OR (profiles > 0 AND p_role <> 'PASSENGER') THEN
        RAISE invalid_role;
    END IF;
    UPDATE app_users
    SET email = LOWER(TRIM(p_email)),
        role = p_role
    WHERE user_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
EXCEPTION
    WHEN invalid_role THEN
        DBMS_OUTPUT.PUT_LINE('A role is required; linked passengers must retain the PASSENGER role.');
        RAISE;
END update_app_user;
/

CREATE OR REPLACE PROCEDURE change_password_hash (
    p_id IN NUMBER,
    p_hash IN VARCHAR2
)
AS
BEGIN
    UPDATE app_users
    SET password_hash = p_hash
    WHERE user_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END change_password_hash;
/

CREATE OR REPLACE PROCEDURE add_passenger (
    p_id IN NUMBER,
    p_user_id IN NUMBER,
    p_name IN VARCHAR2,
    p_phone IN VARCHAR2
)
AS
    user_role app_users.role%TYPE;
    invalid_role EXCEPTION;
BEGIN
    SELECT role
    INTO user_role
    FROM app_users
    WHERE user_id = p_user_id;

    IF user_role IS NULL OR user_role <> 'PASSENGER' THEN
        RAISE invalid_role;
    END IF;

    INSERT INTO passengers VALUES (p_id, p_user_id, p_name, p_phone);
EXCEPTION
    WHEN invalid_role THEN
        DBMS_OUTPUT.PUT_LINE('Create a PASSENGER application user first.');
        RAISE;
END add_passenger;
/

CREATE OR REPLACE PROCEDURE update_passenger (
    p_id IN NUMBER,
    p_name IN VARCHAR2,
    p_phone IN VARCHAR2
)
AS
BEGIN
    UPDATE passengers
    SET full_name = p_name,
        phone = p_phone
    WHERE passenger_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END update_passenger;
/

CREATE OR REPLACE PROCEDURE delete_vehicle (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM vehicles
    WHERE vehicle_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_vehicle;
/

CREATE OR REPLACE PROCEDURE delete_driver (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM drivers
    WHERE driver_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_driver;
/

CREATE OR REPLACE PROCEDURE delete_route (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM routes
    WHERE route_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_route;
/

CREATE OR REPLACE PROCEDURE delete_passenger (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM passengers
    WHERE passenger_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_passenger;
/

CREATE OR REPLACE PROCEDURE delete_app_user (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM app_users
    WHERE user_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_app_user;
/

CREATE OR REPLACE PROCEDURE schedule_maintenance (
    p_id IN NUMBER,
    p_vehicle_id IN NUMBER,
    p_type IN VARCHAR2,
    p_date IN DATE
)
AS
    conflicts NUMBER;
    invalid_service EXCEPTION;
BEGIN
    IF p_date IS NULL OR TRUNC(p_date) < TRUNC(SYSDATE) THEN
        RAISE invalid_service;
    END IF;

    SELECT COUNT(*)
    INTO conflicts
    FROM trips
    WHERE vehicle_id = p_vehicle_id
      AND status = 'SCHEDULED'
      AND departure_at < TRUNC(p_date) + 1
      AND arrival_at > TRUNC(p_date);

    IF conflicts > 0 THEN
        RAISE invalid_service;
    END IF;

    INSERT INTO maintenance_records (maintenance_id, vehicle_id, maintenance_type, scheduled_date)
    VALUES (p_id, p_vehicle_id, p_type, TRUNC(p_date));
EXCEPTION
    WHEN invalid_service THEN
        DBMS_OUTPUT.PUT_LINE('Choose today or a future day without scheduled trips for this vehicle.');
        RAISE;
END schedule_maintenance;
/

CREATE OR REPLACE PROCEDURE update_maintenance (
    p_id IN NUMBER,
    p_type IN VARCHAR2,
    p_date IN DATE
)
AS
    service_vehicle NUMBER;
    conflicts NUMBER;
    invalid_service EXCEPTION;
BEGIN
    SELECT vehicle_id
    INTO service_vehicle
    FROM maintenance_records
    WHERE maintenance_id = p_id
      AND status = 'SCHEDULED';

    IF p_date IS NULL OR TRUNC(p_date) < TRUNC(SYSDATE) THEN
        RAISE invalid_service;
    END IF;

    SELECT COUNT(*)
    INTO conflicts
    FROM trips
    WHERE vehicle_id = service_vehicle
      AND status = 'SCHEDULED'
      AND departure_at < TRUNC(p_date) + 1
      AND arrival_at > TRUNC(p_date);

    IF conflicts > 0 THEN
        RAISE invalid_service;
    END IF;

    UPDATE maintenance_records
    SET maintenance_type = p_type,
        scheduled_date = TRUNC(p_date)
    WHERE maintenance_id = p_id;
EXCEPTION
    WHEN invalid_service THEN
        DBMS_OUTPUT.PUT_LINE('Choose today or a future day without scheduled trips for this vehicle.');
        RAISE;
END update_maintenance;
/

CREATE OR REPLACE PROCEDURE delete_maintenance (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM maintenance_records
    WHERE maintenance_id = p_id
      AND status = 'SCHEDULED';

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
    -- Completed maintenance history is retained.
END delete_maintenance;
/

CREATE OR REPLACE PROCEDURE add_feedback (
    p_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_type IN VARCHAR2
)
AS
    booking_status bookings.status%TYPE;
    trip_status trips.status%TYPE;
    invalid_review EXCEPTION;
BEGIN
    SELECT b.status, t.status
    INTO booking_status, trip_status
    FROM bookings b
    JOIN trips t ON b.trip_id = t.trip_id
    WHERE b.booking_id = p_booking_id;

    IF p_type = 'REVIEW' AND (booking_status <> 'CONFIRMED' OR trip_status <> 'COMPLETED') THEN
        RAISE invalid_review;
    END IF;
    INSERT INTO feedback_records (feedback_id, booking_id, feedback_type)
    VALUES (p_id, p_booking_id, p_type);
EXCEPTION
    WHEN invalid_review THEN
        DBMS_OUTPUT.PUT_LINE('Reviews require a confirmed booking on a completed trip.');
        RAISE;
END add_feedback;
/

CREATE OR REPLACE PROCEDURE update_feedback_status (
    p_id IN NUMBER,
    p_status IN VARCHAR2
)
AS
BEGIN
    UPDATE feedback_records
    SET status = p_status
    WHERE feedback_id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
    -- Retain feedback references for complaint history; do not delete them.
END update_feedback_status;
/
