SET SERVEROUTPUT ON;

CREATE OR REPLACE PROCEDURE schedule_trip (
    p_trip_id IN NUMBER,
    p_route_id IN NUMBER,
    p_vehicle_id IN NUMBER,
    p_driver_id IN NUMBER,
    p_departure IN DATE,
    p_arrival IN DATE
)
AS
    trip_fare routes.base_fare%TYPE;
    vehicle_status vehicles.status%TYPE;
    conflict_count NUMBER;
    invalid_trip EXCEPTION;
BEGIN
    IF p_departure IS NULL OR p_arrival IS NULL
       OR p_departure <= SYSDATE OR p_arrival <= p_departure THEN
        RAISE invalid_trip;
    END IF;

    SELECT base_fare
    INTO trip_fare
    FROM routes
    WHERE route_id = p_route_id;

    SELECT status
    INTO vehicle_status
    FROM vehicles
    WHERE vehicle_id = p_vehicle_id;

    SELECT COUNT(*)
    INTO conflict_count
    FROM trips
    WHERE status = 'SCHEDULED'
      AND (vehicle_id = p_vehicle_id OR driver_id = p_driver_id)
      AND departure_at < p_arrival
      AND arrival_at > p_departure;

    IF vehicle_status <> 'ACTIVE' OR conflict_count > 0 THEN
        RAISE invalid_trip;
    END IF;

    SELECT COUNT(*)
    INTO conflict_count
    FROM maintenance_records
    WHERE vehicle_id = p_vehicle_id
      AND status = 'SCHEDULED'
      AND TRUNC(scheduled_date) < p_arrival
      AND TRUNC(scheduled_date) + 1 > p_departure;

    IF conflict_count > 0 THEN
        RAISE invalid_trip;
    END IF;

    INSERT INTO trips (trip_id, route_id, vehicle_id, driver_id,
                       departure_at, arrival_at, fare)
    VALUES (p_trip_id, p_route_id, p_vehicle_id, p_driver_id,
            p_departure, p_arrival, trip_fare);

    DBMS_OUTPUT.PUT_LINE('Trip added: ' || p_trip_id);
EXCEPTION
    WHEN invalid_trip THEN
        DBMS_OUTPUT.PUT_LINE('Check the trip times and driver/vehicle availability.');
        RAISE;
END schedule_trip;
/

CREATE OR REPLACE PROCEDURE create_booking (
    p_booking_id IN NUMBER,
    p_passenger_id IN NUMBER,
    p_trip_id IN NUMBER
)
AS
    trip_status trips.status%TYPE;
    departure_time trips.departure_at%TYPE;
    invalid_booking EXCEPTION;
BEGIN
    SELECT status, departure_at
    INTO trip_status, departure_time
    FROM trips
    WHERE trip_id = p_trip_id;

    IF trip_status <> 'SCHEDULED' OR departure_time <= SYSDATE THEN
        RAISE invalid_booking;
    END IF;

    INSERT INTO bookings (booking_id, passenger_id, trip_id)
    VALUES (p_booking_id, p_passenger_id, p_trip_id);

    DBMS_OUTPUT.PUT_LINE('Booking added: ' || p_booking_id);
EXCEPTION
    WHEN invalid_booking THEN
        DBMS_OUTPUT.PUT_LINE('This trip is not available for booking.');
        RAISE;
END create_booking;
/

CREATE OR REPLACE PROCEDURE reserve_seat (
    p_ticket_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_seat_number IN NUMBER
)
AS
    booking_trip bookings.trip_id%TYPE;
    booking_status bookings.status%TYPE;
    trip_status trips.status%TYPE;
    departure_time trips.departure_at%TYPE;
    trip_fare trips.fare%TYPE;
    total_seats vehicles.seat_count%TYPE;
    seat_taken NUMBER;
    invalid_seat EXCEPTION;
BEGIN
    SELECT trip_id, status
    INTO booking_trip, booking_status
    FROM bookings
    WHERE booking_id = p_booking_id;

    SELECT t.fare, t.status, t.departure_at, v.seat_count
    INTO trip_fare, trip_status, departure_time, total_seats
    FROM trips t
    JOIN vehicles v ON t.vehicle_id = v.vehicle_id
    WHERE t.trip_id = booking_trip;

    IF p_seat_number IS NULL OR p_seat_number < 1
       OR p_seat_number > total_seats OR p_seat_number <> TRUNC(p_seat_number)
       OR booking_status <> 'PENDING' OR trip_status <> 'SCHEDULED'
       OR departure_time <= SYSDATE THEN
        RAISE invalid_seat;
    END IF;

    SELECT COUNT(*)
    INTO seat_taken
    FROM tickets t
    JOIN bookings b ON t.booking_id = b.booking_id
    WHERE b.trip_id = booking_trip
      AND t.seat_number = p_seat_number
      AND t.status IN ('RESERVED', 'ISSUED');

    IF seat_taken > 0 THEN
        RAISE invalid_seat;
    END IF;

    INSERT INTO tickets (ticket_id, booking_id, seat_number, fare_amount)
    VALUES (p_ticket_id, p_booking_id, p_seat_number, trip_fare);

    DBMS_OUTPUT.PUT_LINE('Seat reserved: ' || p_seat_number);
EXCEPTION
    WHEN invalid_seat THEN
        DBMS_OUTPUT.PUT_LINE('Seat unavailable, invalid seat number, or booking closed.');
        RAISE;
END reserve_seat;
/

CREATE OR REPLACE FUNCTION available_seats (p_trip_id IN NUMBER)
RETURN NUMBER
IS
    total_seats NUMBER;
    booked_seats NUMBER;
BEGIN
    SELECT v.seat_count
    INTO total_seats
    FROM vehicles v
    JOIN trips t ON v.vehicle_id = t.vehicle_id
    WHERE t.trip_id = p_trip_id;

    SELECT COUNT(*)
    INTO booked_seats
    FROM tickets t
    JOIN bookings b ON t.booking_id = b.booking_id
    WHERE b.trip_id = p_trip_id
      AND t.status IN ('RESERVED', 'ISSUED');

    RETURN total_seats - booked_seats;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN NULL;
END;
/

CREATE OR REPLACE PROCEDURE record_payment (
    p_payment_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_amount IN NUMBER,
    p_method IN VARCHAR2
)
AS
    booking_status bookings.status%TYPE;
    trip_status trips.status%TYPE;
    departure_time trips.departure_at%TYPE;
    total_amount NUMBER;
    invalid_payment EXCEPTION;
BEGIN
    SELECT b.status, t.status, t.departure_at
    INTO booking_status, trip_status, departure_time
    FROM bookings b
    JOIN trips t ON b.trip_id = t.trip_id
    WHERE b.booking_id = p_booking_id;

    SELECT SUM(fare_amount)
    INTO total_amount
    FROM tickets
    WHERE booking_id = p_booking_id
      AND status = 'RESERVED';

    IF booking_status <> 'PENDING' OR trip_status <> 'SCHEDULED'
       OR departure_time <= SYSDATE OR total_amount IS NULL
       OR p_amount IS NULL OR p_amount <> total_amount THEN
        RAISE invalid_payment;
    END IF;

    INSERT INTO payments (payment_id, booking_id, amount, payment_method)
    VALUES (p_payment_id, p_booking_id, p_amount, p_method);

    UPDATE tickets
    SET status = 'ISSUED'
    WHERE booking_id = p_booking_id
      AND status = 'RESERVED';

    UPDATE bookings
    SET status = 'CONFIRMED'
    WHERE booking_id = p_booking_id;

    DBMS_OUTPUT.PUT_LINE('Payment recorded: ' || p_amount);
EXCEPTION
    WHEN invalid_payment THEN
        DBMS_OUTPUT.PUT_LINE('Check booking, total amount and payment method.');
        RAISE;
END record_payment;
/

CREATE OR REPLACE PROCEDURE cancel_booking (p_booking_id IN NUMBER)
AS
    booking_status bookings.status%TYPE;
    departure_time trips.departure_at%TYPE;
    invalid_cancel EXCEPTION;
BEGIN
    SELECT b.status, t.departure_at
    INTO booking_status, departure_time
    FROM bookings b
    JOIN trips t ON b.trip_id = t.trip_id
    WHERE b.booking_id = p_booking_id;

    IF booking_status = 'CANCELLED' OR departure_time <= SYSDATE THEN
        RAISE invalid_cancel;
    END IF;

    UPDATE tickets
    SET status = 'CANCELLED'
    WHERE booking_id = p_booking_id;

    UPDATE bookings
    SET status = 'CANCELLED'
    WHERE booking_id = p_booking_id;

    DBMS_OUTPUT.PUT_LINE('Booking cancelled: ' || p_booking_id);
EXCEPTION
    WHEN invalid_cancel THEN
        DBMS_OUTPUT.PUT_LINE('Booking is already cancelled or the trip has departed.');
        RAISE;
END cancel_booking;
/

CREATE OR REPLACE PROCEDURE process_refund (
    p_refund_id IN NUMBER,
    p_payment_id IN NUMBER,
    p_reason IN VARCHAR2
)
AS
    paid_amount payments.amount%TYPE;
    booking_status bookings.status%TYPE;
    invalid_refund EXCEPTION;
BEGIN
    SELECT p.amount, b.status
    INTO paid_amount, booking_status
    FROM payments p
    JOIN bookings b ON p.booking_id = b.booking_id
    WHERE p.payment_id = p_payment_id;

    IF booking_status <> 'CANCELLED' THEN
        RAISE invalid_refund;
    END IF;

    INSERT INTO refunds (refund_id, payment_id, amount, reason)
    VALUES (p_refund_id, p_payment_id, paid_amount, p_reason);

    DBMS_OUTPUT.PUT_LINE('Refund recorded: ' || paid_amount);
EXCEPTION
    WHEN invalid_refund THEN
        DBMS_OUTPUT.PUT_LINE('Cancel the booking before refunding it.');
        RAISE;
END process_refund;
/

CREATE OR REPLACE PROCEDURE complete_maintenance (
    p_maintenance_id IN NUMBER,
    p_cost IN NUMBER
)
AS
    invalid_service EXCEPTION;
BEGIN
    IF p_cost IS NULL OR p_cost < 0 THEN
        RAISE invalid_service;
    END IF;

    UPDATE maintenance_records
    SET status = 'COMPLETED', completed_date = SYSDATE, cost = p_cost
    WHERE maintenance_id = p_maintenance_id AND status = 'SCHEDULED'
      AND TRUNC(scheduled_date) <= TRUNC(SYSDATE);

    IF SQL%ROWCOUNT = 0 THEN
        RAISE invalid_service;
    ELSE
        DBMS_OUTPUT.PUT_LINE('Maintenance completed.');
    END IF;
EXCEPTION
    WHEN invalid_service THEN
        DBMS_OUTPUT.PUT_LINE('Use a nonnegative cost and an unfinished service due today or earlier.');
        RAISE;
END complete_maintenance;
/
