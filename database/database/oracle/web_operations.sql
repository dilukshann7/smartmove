CREATE OR REPLACE PROCEDURE smartmove_database.create_booking (
    p_booking_id IN NUMBER,
    p_passenger_id IN NUMBER,
    p_trip_id IN NUMBER
) AS
    v_status smartmove_database.trips.status%TYPE;
    v_departure smartmove_database.trips.departure_at%TYPE;
BEGIN
    SELECT status, departure_at
    INTO v_status, v_departure
    FROM smartmove_database.trips
    WHERE trip_id = p_trip_id
    FOR UPDATE;
    IF v_status <> 'SCHEDULED' OR v_departure <= SYSDATE THEN
        RAISE_APPLICATION_ERROR(-20001, 'Trip is unavailable.');
    END IF;
    INSERT INTO smartmove_database.bookings (booking_id, passenger_id, trip_id)
    VALUES (p_booking_id, p_passenger_id, p_trip_id);
END;
/

CREATE OR REPLACE PROCEDURE smartmove_database.reserve_seat (
    p_ticket_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_seat_number IN NUMBER
) AS
    v_trip_id NUMBER;
    v_booking_status VARCHAR2(12);
    v_booked_at DATE;
    v_trip_status VARCHAR2(12);
    v_departure DATE;
    v_fare NUMBER;
    v_seat_count NUMBER;
    v_taken NUMBER;
BEGIN
    SELECT trip_id, status, booked_at
    INTO v_trip_id, v_booking_status, v_booked_at
    FROM smartmove_database.bookings
    WHERE booking_id = p_booking_id;

    SELECT t.status, t.departure_at, t.fare, v.seat_count
    INTO v_trip_status, v_departure, v_fare, v_seat_count
    FROM smartmove_database.trips t
    JOIN smartmove_database.vehicles v ON v.vehicle_id = t.vehicle_id
    WHERE t.trip_id = v_trip_id FOR UPDATE OF t.status;

    IF p_seat_number IS NULL OR p_seat_number <> TRUNC(p_seat_number)
       OR p_seat_number < 1 OR p_seat_number > v_seat_count
       OR v_booking_status <> 'PENDING'
       OR v_booked_at <= SYSDATE - (30 / 1440)
       OR v_trip_status <> 'SCHEDULED'
       OR v_departure <= SYSDATE THEN
        RAISE_APPLICATION_ERROR(-20002, 'Seat or booking is unavailable.');
    END IF;

    SELECT COUNT(*)
    INTO v_taken
    FROM smartmove_database.tickets t
    JOIN smartmove_database.bookings b ON b.booking_id = t.booking_id
    WHERE b.trip_id = v_trip_id
      AND t.seat_number = p_seat_number
      AND (t.status = 'ISSUED' OR
           (t.status = 'RESERVED' AND b.status = 'PENDING'
            AND b.booked_at > SYSDATE - (30 / 1440)));
    IF v_taken > 0 THEN
        RAISE_APPLICATION_ERROR(-20003, 'Seat is already reserved.');
    END IF;

    INSERT INTO smartmove_database.tickets (ticket_id, booking_id, seat_number, fare_amount)
    VALUES (p_ticket_id, p_booking_id, p_seat_number, v_fare);
END;
/

CREATE OR REPLACE FUNCTION smartmove_database.available_seats (p_trip_id IN NUMBER)
RETURN NUMBER AS
    v_total NUMBER;
    v_taken NUMBER;
BEGIN
    SELECT v.seat_count
    INTO v_total
    FROM smartmove_database.trips t
    JOIN smartmove_database.vehicles v ON v.vehicle_id = t.vehicle_id
    WHERE t.trip_id = p_trip_id;
    SELECT COUNT(*)
    INTO v_taken
    FROM smartmove_database.tickets t
    JOIN smartmove_database.bookings b ON b.booking_id = t.booking_id
    WHERE b.trip_id = p_trip_id
      AND (t.status = 'ISSUED' OR
           (t.status = 'RESERVED' AND b.status = 'PENDING'
            AND b.booked_at > SYSDATE - (30 / 1440)));
    RETURN v_total - v_taken;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN NULL;
END;
/

CREATE OR REPLACE PROCEDURE smartmove_database.record_payment (
    p_payment_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_amount IN NUMBER,
    p_method IN VARCHAR2
) AS
    v_status VARCHAR2(12);
    v_booked_at DATE;
    v_trip_status VARCHAR2(12);
    v_departure DATE;
    v_total NUMBER;
BEGIN
    SELECT b.status, b.booked_at, t.status, t.departure_at
    INTO v_status, v_booked_at, v_trip_status, v_departure
    FROM smartmove_database.bookings b
    JOIN smartmove_database.trips t ON t.trip_id = b.trip_id
    WHERE b.booking_id = p_booking_id
    FOR UPDATE OF b.status;

    SELECT SUM(fare_amount)
    INTO v_total
    FROM smartmove_database.tickets
    WHERE booking_id = p_booking_id
      AND status = 'RESERVED';
    IF v_status <> 'PENDING' OR v_booked_at <= SYSDATE - (30 / 1440)
       OR v_trip_status <> 'SCHEDULED'
       OR v_departure <= SYSDATE
       OR v_total IS NULL
       OR p_amount IS NULL
       OR p_amount <> v_total THEN
        RAISE_APPLICATION_ERROR(-20004, 'Booking or payment is invalid or expired.');
    END IF;
    INSERT INTO smartmove_database.payments (payment_id, booking_id, amount, payment_method)
    VALUES (p_payment_id, p_booking_id, p_amount, p_method);
    UPDATE smartmove_database.tickets
    SET status = 'ISSUED'
    WHERE booking_id = p_booking_id
      AND status = 'RESERVED';

    UPDATE smartmove_database.bookings
    SET status = 'CONFIRMED'
    WHERE booking_id = p_booking_id;
END;
/

CREATE OR REPLACE PROCEDURE smartmove_database.web_register_passenger (
    p_email IN VARCHAR2,
    p_password_hash IN VARCHAR2,
    p_full_name IN VARCHAR2,
    p_phone IN VARCHAR2,
    p_user_id IN NUMBER,
    p_passenger_id IN NUMBER
) AS
BEGIN
    INSERT INTO smartmove_database.app_users (user_id, email, password_hash, role)
    VALUES (p_user_id, LOWER(TRIM(p_email)), p_password_hash, 'PASSENGER');
    INSERT INTO smartmove_database.passengers (passenger_id, user_id, full_name, phone)
    VALUES (p_passenger_id, p_user_id, TRIM(p_full_name), TRIM(p_phone));
END;
/

CREATE OR REPLACE PROCEDURE smartmove_database.web_cancel_booking (
    p_booking_id IN NUMBER,
    p_passenger_id IN NUMBER,
    p_refund_id IN NUMBER,
    p_changed OUT NUMBER,
    p_refund_amount OUT NUMBER
) AS
    v_status smartmove_database.bookings.status%TYPE;
    v_departure DATE;
    v_payment_id NUMBER;
    v_payment_amount NUMBER;
BEGIN
    p_changed := 0;
    p_refund_amount := 0;
    SELECT status
    INTO v_status
    FROM smartmove_database.bookings
    WHERE booking_id = p_booking_id
      AND passenger_id = p_passenger_id
    FOR UPDATE;

    IF v_status = 'CANCELLED' THEN
        SELECT NVL(MAX(r.amount), 0)
        INTO p_refund_amount
        FROM smartmove_database.payments p
        LEFT JOIN smartmove_database.refunds r ON r.payment_id = p.payment_id
        WHERE p.booking_id = p_booking_id;
        RETURN;
    END IF;

    SELECT t.departure_at
    INTO v_departure
    FROM smartmove_database.bookings b
    JOIN smartmove_database.trips t ON t.trip_id = b.trip_id
    WHERE b.booking_id = p_booking_id;
    IF v_departure <= SYSDATE THEN
        RAISE_APPLICATION_ERROR(-20021, 'Trip has departed.');
    END IF;

    IF v_status = 'CONFIRMED' THEN
        SELECT payment_id, amount
        INTO v_payment_id, v_payment_amount
        FROM smartmove_database.payments
        WHERE booking_id = p_booking_id;
    END IF;

    smartmove_database.cancel_booking(p_booking_id);
    IF v_status = 'CONFIRMED' THEN
        smartmove_database.process_refund(
            p_refund_id,
            v_payment_id,
            'Passenger cancelled before departure'
        );
        p_refund_amount := v_payment_amount;
    END IF;
    p_changed := 1;
END;
/

CREATE OR REPLACE PROCEDURE smartmove_database.web_update_profile (
    p_passenger_id IN NUMBER,
    p_name IN VARCHAR2,
    p_phone IN VARCHAR2
) AS
BEGIN
    UPDATE smartmove_database.passengers
    SET full_name = TRIM(p_name), phone = TRIM(p_phone)
    WHERE passenger_id = p_passenger_id;
    IF SQL%ROWCOUNT <> 1 THEN
        RAISE_APPLICATION_ERROR(-20022, 'Passenger not found.');
    END IF;
END;
/

CREATE OR REPLACE PROCEDURE smartmove_database.web_submit_feedback (
    p_feedback_id IN NUMBER,
    p_booking_id IN NUMBER,
    p_passenger_id IN NUMBER,
    p_type IN VARCHAR2
) AS
    v_booking_status smartmove_database.bookings.status%TYPE;
    v_trip_status smartmove_database.trips.status%TYPE;
    v_review_count NUMBER;
BEGIN
    SELECT b.status, t.status
    INTO v_booking_status, v_trip_status
    FROM smartmove_database.bookings b
    JOIN smartmove_database.trips t ON t.trip_id = b.trip_id
    WHERE b.booking_id = p_booking_id
      AND b.passenger_id = p_passenger_id
    FOR UPDATE OF b.status;
    IF p_type NOT IN ('REVIEW', 'COMPLAINT') OR p_type IS NULL THEN
        RAISE_APPLICATION_ERROR(-20023, 'Invalid feedback type.');
    END IF;
    IF p_type = 'REVIEW' AND
       (v_booking_status <> 'CONFIRMED' OR v_trip_status <> 'COMPLETED') THEN
        RAISE_APPLICATION_ERROR(-20024, 'Review requires a completed paid trip.');
    END IF;
    IF p_type = 'REVIEW' THEN
        SELECT COUNT(*)
        INTO v_review_count
        FROM smartmove_database.feedback_records
        WHERE booking_id = p_booking_id AND feedback_type = 'REVIEW';
        IF v_review_count > 0 THEN
            RAISE_APPLICATION_ERROR(-20025, 'A review for this booking already exists.');
        END IF;
    END IF;
    INSERT INTO smartmove_database.feedback_records
        (feedback_id, booking_id, feedback_type, status)
    VALUES (p_feedback_id, p_booking_id, p_type, 'OPEN');
END;
/
