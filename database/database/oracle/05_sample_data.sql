SET SERVEROUTPUT ON;
WHENEVER SQLERROR EXIT FAILURE ROLLBACK

INSERT INTO app_users VALUES (1, 'passenger1@example.test', 'DISABLED_DEMO_HASH', 'PASSENGER');
INSERT INTO app_users VALUES (2, 'passenger2@example.test', 'DISABLED_DEMO_HASH', 'PASSENGER');
INSERT INTO app_users VALUES (3, 'admin@example.test', 'DISABLED_DEMO_HASH', 'ADMIN');

INSERT INTO passengers VALUES (1, 1, 'Demo Passenger One', '0700000001');
INSERT INTO passengers VALUES (2, 2, 'Demo Passenger Two', '0700000002');

INSERT INTO drivers VALUES (1, 'Demo Driver One', '0710000001', 'DEMO-LIC-1');
INSERT INTO drivers VALUES (2, 'Demo Driver Two', '0710000002', 'DEMO-LIC-2');

INSERT INTO vehicles VALUES (1, 'DEMO-001', 'VAN', 12, 'ACTIVE');
INSERT INTO vehicles VALUES (2, 'DEMO-002', 'VAN', 8, 'ACTIVE');
INSERT INTO vehicles VALUES (3, 'DEMO-003', 'BUS', 30, 'MAINTENANCE');

INSERT INTO routes VALUES (1, 'Colombo to Kandy', 'Colombo', 'Kandy', 500);
INSERT INTO routes VALUES (2, 'Colombo to Galle', 'Colombo', 'Galle', 800);

INSERT INTO trips VALUES (1, 1, 1, 1, SYSDATE - 2, SYSDATE - 2 + 3/24, 500, 'COMPLETED');
INSERT INTO bookings VALUES (1, 1, 1, SYSDATE - 3, 'CONFIRMED');
INSERT INTO tickets VALUES (1, 1, 1, 500, 'ISSUED');
INSERT INTO payments VALUES (1, 1, 500, 'CASH', SYSDATE - 3);
INSERT INTO feedback_records VALUES (1, 1, 'REVIEW', 'OPEN');

BEGIN
    schedule_trip(2, 2, 2, 2, SYSDATE + 7, SYSDATE + 7 + 2/24);

    create_booking(2, 2, 2);
    reserve_seat(2, 2, 1);
    reserve_seat(3, 2, 2);
    record_payment(2, 2, 1600, 'CASH');

    create_booking(3, 1, 2);
    reserve_seat(4, 3, 3);
    record_payment(3, 3, 800, 'CARD');
    cancel_booking(3);
    process_refund(1, 3, 'Passenger cancelled');
END;
/

INSERT INTO maintenance_records (maintenance_id, vehicle_id, maintenance_type, scheduled_date)
VALUES (1, 3, 'Brake inspection', SYSDATE - 1);
INSERT INTO maintenance_records (maintenance_id, vehicle_id, maintenance_type, scheduled_date)
VALUES (2, 1, 'Routine service', SYSDATE + 14);

WHENEVER SQLERROR CONTINUE NONE
