SET SERVEROUTPUT ON;

CREATE OR REPLACE PROCEDURE popular_routes
AS
    CURSOR route_cursor IS
        SELECT r.route_name, COUNT(t.ticket_id) AS tickets_sold
        FROM routes r
        JOIN trips tr ON r.route_id = tr.route_id
        JOIN bookings b ON tr.trip_id = b.trip_id
        JOIN tickets t ON b.booking_id = t.booking_id
        WHERE t.status = 'ISSUED'
        GROUP BY r.route_name
        ORDER BY tickets_sold DESC;
BEGIN
    FOR route_rec IN route_cursor LOOP
        DBMS_OUTPUT.PUT_LINE(route_rec.route_name || ': ' || route_rec.tickets_sold || ' tickets');
    END LOOP;
END popular_routes;
/

CREATE OR REPLACE PROCEDURE revenue
AS
    total_payments NUMBER;
    total_refunds NUMBER;
BEGIN
    SELECT SUM(amount)
    INTO total_payments
    FROM payments;

    SELECT SUM(amount)
    INTO total_refunds
    FROM refunds;

    IF total_payments IS NULL THEN
        total_payments := 0;
    END IF;
    IF total_refunds IS NULL THEN
        total_refunds := 0;
    END IF;

    DBMS_OUTPUT.PUT_LINE('Payments: ' || total_payments);
    DBMS_OUTPUT.PUT_LINE('Refunds: ' || total_refunds);
    DBMS_OUTPUT.PUT_LINE('Net revenue: ' || (total_payments - total_refunds));
END revenue;
/

CREATE OR REPLACE PROCEDURE passenger_history (p_passenger_id IN NUMBER)
AS
    CURSOR history_cursor IS
        SELECT b.booking_id, r.route_name, t.seat_number, b.status
        FROM bookings b
        JOIN trips tr ON b.trip_id = tr.trip_id
        JOIN routes r ON tr.route_id = r.route_id
        JOIN tickets t ON b.booking_id = t.booking_id
        WHERE b.passenger_id = p_passenger_id
        ORDER BY b.booking_id, t.ticket_id;
BEGIN
    FOR history_rec IN history_cursor LOOP
        DBMS_OUTPUT.PUT_LINE('Booking ' || history_rec.booking_id || ': '
            || history_rec.route_name || ', Seat ' || history_rec.seat_number
            || ', ' || history_rec.status);
    END LOOP;
END passenger_history;
/

CREATE OR REPLACE PROCEDURE maintenance_due (p_as_of IN DATE)
AS
    CURSOR maintenance_cursor IS
        SELECT m.maintenance_id, v.registration_number, m.maintenance_type
        FROM maintenance_records m
        JOIN vehicles v ON m.vehicle_id = v.vehicle_id
        WHERE m.status = 'SCHEDULED'
          AND m.scheduled_date < TRUNC(p_as_of) + 1
        ORDER BY m.scheduled_date;
BEGIN
    FOR maintenance_rec IN maintenance_cursor LOOP
        DBMS_OUTPUT.PUT_LINE('Maintenance ' || maintenance_rec.maintenance_id || ': '
            || maintenance_rec.registration_number || ', ' || maintenance_rec.maintenance_type);
    END LOOP;
END maintenance_due;
/

CREATE OR REPLACE PROCEDURE trip_occupancy
AS
    CURSOR trip_cursor IS
        SELECT t.trip_id, v.seat_count
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        ORDER BY t.trip_id;
    occupied_seats NUMBER;
    occupancy_percent NUMBER;
BEGIN
    FOR trip_rec IN trip_cursor LOOP
        SELECT COUNT(*)
        INTO occupied_seats
        FROM tickets t
        JOIN bookings b ON t.booking_id = b.booking_id
        WHERE b.trip_id = trip_rec.trip_id
          AND t.status = 'ISSUED';

        occupancy_percent := occupied_seats * 100 / trip_rec.seat_count;

        DBMS_OUTPUT.PUT_LINE('Trip ' || trip_rec.trip_id || ': '
            || occupied_seats || '/' || trip_rec.seat_count
            || ' seats, ' || ROUND(occupancy_percent, 2) || '%');
    END LOOP;
END trip_occupancy;
/
