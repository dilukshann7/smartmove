WHENEVER SQLERROR EXIT FAILURE ROLLBACK
SET SERVEROUTPUT ON;

BEGIN
    schedule_trip(90, 1, 1, 1, SYSDATE + 30, SYSDATE + 30 + 2/24);
    reschedule_trip(90, 1, 1, SYSDATE + 31, SYSDATE + 31 + 2/24);
    create_booking(90, 1, 90);
    reserve_seat(90, 90, 1);
    reserve_seat(91, 90, 2);
    remove_reserved_ticket(91);
    record_payment(90, 90, 500, 'CASH');
END;
/
SELECT * FROM trips WHERE trip_id = 90;
SELECT * FROM tickets WHERE booking_id = 90;

BEGIN
    cancel_trip(90);
    process_refund(90, 90, 'Practice trip cancellation');
END;
/
SELECT * FROM bookings WHERE booking_id = 90;
SELECT * FROM refunds WHERE payment_id = 90;
SELECT * FROM booking_status_history WHERE booking_id = 90;

BEGIN
    schedule_trip(91, 1, 1, 1, SYSDATE + 32, SYSDATE + 32 + 2/24);
    delete_trip(91);
END;
/

INSERT INTO trips VALUES (92, 1, 1, 1, SYSDATE - 4, SYSDATE - 4 + 2/24, 500, 'SCHEDULED');
INSERT INTO bookings VALUES (92, 1, 92, SYSDATE - 5, 'PENDING');
INSERT INTO tickets VALUES (92, 92, 1, 500, 'RESERVED');
BEGIN
    complete_trip(92);
END;
/
SELECT * FROM trips WHERE trip_id = 92;
SELECT * FROM bookings WHERE booking_id = 92;
SELECT * FROM tickets WHERE booking_id = 92;

BEGIN
    DBMS_OUTPUT.PUT_LINE('Trip 90 free seats: ' || available_seats(90));
    popular_routes;
    revenue;
    passenger_history(1);
    maintenance_due(SYSDATE);
    trip_occupancy;
END;
/
ROLLBACK;
WHENEVER SQLERROR CONTINUE NONE
