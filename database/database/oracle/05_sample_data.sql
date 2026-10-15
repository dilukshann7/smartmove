SET SERVEROUTPUT ON;
WHENEVER SQLERROR EXIT FAILURE ROLLBACK

-- Fleet and trip examples only. Passenger/admin accounts are created separately.
-- Legacy disabled accounts and their booking/payment/feedback data are not seeded.

INSERT INTO drivers VALUES (1, 'Demo Driver One', '0710000001', 'DEMO-LIC-1');
INSERT INTO drivers VALUES (2, 'Demo Driver Two', '0710000002', 'DEMO-LIC-2');

INSERT INTO vehicles VALUES (1, 'DEMO-001', 'VAN', 12, 'ACTIVE');
INSERT INTO vehicles VALUES (2, 'DEMO-002', 'VAN', 8, 'ACTIVE');
INSERT INTO vehicles VALUES (3, 'DEMO-003', 'BUS', 30, 'MAINTENANCE');

INSERT INTO routes VALUES (1, 'Colombo to Kandy', 'Colombo', 'Kandy', 500);
INSERT INTO routes VALUES (2, 'Colombo to Galle', 'Colombo', 'Galle', 800);

INSERT INTO trips VALUES (1, 1, 1, 1, SYSDATE - 2, SYSDATE - 2 + 3/24, 500, 'COMPLETED');

BEGIN
    schedule_trip(2, 2, 2, 2, SYSDATE + 7, SYSDATE + 7 + 2/24);
END;
/

INSERT INTO maintenance_records (maintenance_id, vehicle_id, maintenance_type, scheduled_date)
VALUES (1, 3, 'Brake inspection', SYSDATE - 1);
INSERT INTO maintenance_records (maintenance_id, vehicle_id, maintenance_type, scheduled_date)
VALUES (2, 1, 'Routine service', SYSDATE + 14);

WHENEVER SQLERROR CONTINUE NONE
