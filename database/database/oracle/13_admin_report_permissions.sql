WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
ALTER SESSION SET CONTAINER = XEPDB1;

-- Allow the authenticated admin API to run the existing coursework reports.
GRANT EXECUTE ON smartmove_database.popular_routes TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.revenue TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.passenger_history TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.maintenance_due TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.trip_occupancy TO smartmove_database_app;
