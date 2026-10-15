-- Fresh installation only: run after the base coursework schema in XEPDB1.
-- For the existing database, use 12_simplify_existing_web.sql instead.
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
ALTER SESSION SET CONTAINER = XEPDB1;

@@web_operations.sql

CREATE OR REPLACE VIEW smartmove_database.web_passenger_login AS
SELECT u.user_id, u.email, u.password_hash,
       p.passenger_id, p.full_name, p.phone
FROM smartmove_database.app_users u
JOIN smartmove_database.passengers p ON p.user_id = u.user_id
WHERE u.role = 'PASSENGER';

CREATE OR REPLACE VIEW smartmove_database.web_trip_search AS
SELECT t.trip_id, r.route_name, r.origin, r.destination,
       t.departure_at, t.arrival_at, t.fare,
       v.vehicle_type, v.registration_number, v.seat_count,
       smartmove_database.available_seats(t.trip_id) available_seats
FROM smartmove_database.trips t
JOIN smartmove_database.routes r ON r.route_id = t.route_id
JOIN smartmove_database.vehicles v ON v.vehicle_id = t.vehicle_id
WHERE t.status = 'SCHEDULED' AND t.departure_at > SYSDATE;

GRANT CREATE SESSION TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_trip_search TO smartmove_database_app;
GRANT SELECT ON smartmove_database.trips TO smartmove_database_app;
GRANT SELECT ON smartmove_database.routes TO smartmove_database_app;
GRANT SELECT ON smartmove_database.vehicles TO smartmove_database_app;
GRANT SELECT ON smartmove_database.bookings TO smartmove_database_app;
GRANT SELECT ON smartmove_database.tickets TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_passenger_login TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_register_passenger TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.create_booking TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.reserve_seat TO smartmove_database_app;
