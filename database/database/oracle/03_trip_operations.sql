SET SERVEROUTPUT ON;

CREATE OR REPLACE PROCEDURE reschedule_trip (
    p_id IN NUMBER,
    p_vehicle_id IN NUMBER,
    p_driver_id IN NUMBER,
    p_departure IN DATE,
    p_arrival IN DATE
)
AS
    row_count NUMBER;
    vehicle_status vehicles.status%TYPE;
    invalid_change EXCEPTION;
BEGIN
    SELECT COUNT(*)
    INTO row_count
    FROM bookings
    WHERE trip_id = p_id;

    IF row_count > 0
       OR p_departure IS NULL
       OR p_arrival IS NULL
       OR p_departure <= SYSDATE
       OR p_arrival <= p_departure
    THEN
        RAISE invalid_change;
    END IF;

    SELECT status
    INTO vehicle_status
    FROM vehicles
    WHERE vehicle_id = p_vehicle_id;

    SELECT COUNT(*)
    INTO row_count
    FROM trips
    WHERE trip_id <> p_id
      AND status = 'SCHEDULED'
      AND (vehicle_id = p_vehicle_id OR driver_id = p_driver_id)
      AND departure_at < p_arrival
      AND arrival_at > p_departure;

    IF vehicle_status <> 'ACTIVE' OR row_count > 0 THEN
        RAISE invalid_change;
    END IF;

    SELECT COUNT(*)
    INTO row_count
    FROM maintenance_records
    WHERE vehicle_id = p_vehicle_id
      AND status = 'SCHEDULED'
      AND TRUNC(scheduled_date) < p_arrival
      AND TRUNC(scheduled_date) + 1 > p_departure;

    IF row_count > 0 THEN
        RAISE invalid_change;
    END IF;

    UPDATE trips
    SET vehicle_id = p_vehicle_id,
        driver_id = p_driver_id,
        departure_at = p_departure,
        arrival_at = p_arrival
    WHERE trip_id = p_id
      AND status = 'SCHEDULED'
      AND departure_at > SYSDATE;

    IF SQL%ROWCOUNT = 0 THEN
        RAISE invalid_change;
    END IF;
EXCEPTION
    WHEN invalid_change THEN
        DBMS_OUTPUT.PUT_LINE('Use an unbooked future trip, valid times and an available driver/vehicle.');
        RAISE;
END reschedule_trip;
/

CREATE OR REPLACE PROCEDURE cancel_trip (p_id IN NUMBER)
AS
    trip_status trips.status%TYPE;
    departure_time DATE;
    invalid_trip EXCEPTION;
BEGIN
    SELECT status, departure_at
    INTO trip_status, departure_time
    FROM trips
    WHERE trip_id = p_id;

    IF trip_status <> 'SCHEDULED' OR departure_time <= SYSDATE THEN
        RAISE invalid_trip;
    END IF;

    FOR booking IN (
        SELECT booking_id
        FROM bookings
        WHERE trip_id = p_id
          AND status <> 'CANCELLED'
    ) LOOP
        cancel_booking(booking.booking_id);
    END LOOP;

    UPDATE trips
    SET status = 'CANCELLED'
    WHERE trip_id = p_id;

    DBMS_OUTPUT.PUT_LINE('Trip cancelled. Refund each paid booking with process_refund.');
EXCEPTION
    WHEN invalid_trip THEN
        DBMS_OUTPUT.PUT_LINE('Only scheduled trips before departure can be cancelled.');
        RAISE;
END cancel_trip;
/

CREATE OR REPLACE PROCEDURE complete_trip (p_id IN NUMBER)
AS
    trip_status trips.status%TYPE;
    arrival_time DATE;
    invalid_trip EXCEPTION;
BEGIN
    SELECT status, arrival_at
    INTO trip_status, arrival_time
    FROM trips
    WHERE trip_id = p_id;

    IF trip_status <> 'SCHEDULED' OR arrival_time > SYSDATE THEN
        RAISE invalid_trip;
    END IF;

    UPDATE tickets
    SET status = 'CANCELLED'
    WHERE booking_id IN (
        SELECT booking_id
        FROM bookings
        WHERE trip_id = p_id
          AND status = 'PENDING'
    );

    UPDATE bookings
    SET status = 'CANCELLED'
    WHERE trip_id = p_id
      AND status = 'PENDING';

    UPDATE trips
    SET status = 'COMPLETED'
    WHERE trip_id = p_id;
EXCEPTION
    WHEN invalid_trip THEN
        DBMS_OUTPUT.PUT_LINE('Complete a scheduled trip only after its arrival time.');
        RAISE;
END complete_trip;
/

CREATE OR REPLACE PROCEDURE delete_trip (p_id IN NUMBER)
AS
BEGIN
    -- Foreign keys prevent deleting trips with booking history.
    DELETE FROM trips
    WHERE trip_id = p_id
      AND departure_at > SYSDATE
      AND status <> 'COMPLETED';

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END delete_trip;
/

CREATE OR REPLACE PROCEDURE remove_reserved_ticket (p_id IN NUMBER)
AS
BEGIN
    DELETE FROM tickets
    WHERE ticket_id = p_id
      AND status = 'RESERVED'
      AND booking_id IN (
          SELECT b.booking_id
          FROM bookings b
          JOIN trips t ON b.trip_id = t.trip_id
          WHERE b.status = 'PENDING'
            AND t.status = 'SCHEDULED'
            AND t.departure_at > SYSDATE
      );

    IF SQL%ROWCOUNT = 0 THEN
        RAISE NO_DATA_FOUND;
    END IF;
END remove_reserved_ticket;
/
