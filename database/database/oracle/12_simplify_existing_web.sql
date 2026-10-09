WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
ALTER SESSION SET CONTAINER = XEPDB1;

BEGIN
    DBMS_SCHEDULER.DROP_JOB('SMARTMOVE_DATABASE.EXPIRE_BOOKING_HOLDS');
END;
/

@@web_operations.sql

GRANT EXECUTE ON smartmove_database.record_payment TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.process_refund TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.cancel_trip TO smartmove_database_app;

DECLARE
    error_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO error_count
    FROM DBA_ERRORS
    WHERE owner = 'SMARTMOVE_DATABASE'
      AND name IN ('CREATE_BOOKING', 'RESERVE_SEAT', 'AVAILABLE_SEATS',
                   'RECORD_PAYMENT', 'WEB_REGISTER_PASSENGER', 'WEB_CANCEL_BOOKING',
                   'WEB_UPDATE_PROFILE', 'WEB_SUBMIT_FEEDBACK');
    IF error_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20999, 'Website procedure compilation failed.');
    END IF;
END;
/

DROP INDEX smartmove_database.web_one_review_per_booking;
DROP PROCEDURE smartmove_database.expire_pending_bookings;
DROP PROCEDURE smartmove_database.web_admin_record_payment;
DROP PROCEDURE smartmove_database.web_admin_cancel_booking;
DROP PROCEDURE smartmove_database.web_admin_cancel_trip;
DROP PROCEDURE smartmove_database.web_admin_record_refund;
DROP SEQUENCE smartmove_database.web_user_seq;
DROP SEQUENCE smartmove_database.web_passenger_seq;
DROP SEQUENCE smartmove_database.web_booking_seq;
DROP SEQUENCE smartmove_database.web_ticket_seq;
DROP SEQUENCE smartmove_database.web_refund_seq;
DROP SEQUENCE smartmove_database.web_feedback_seq;
DROP SEQUENCE smartmove_database.web_route_seq;
DROP SEQUENCE smartmove_database.web_trip_seq;
DROP SEQUENCE smartmove_database.web_vehicle_seq;
DROP SEQUENCE smartmove_database.web_driver_seq;
DROP SEQUENCE smartmove_database.web_maintenance_seq;
DROP SEQUENCE smartmove_database.web_payment_seq;
