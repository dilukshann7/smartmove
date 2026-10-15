WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
ALTER SESSION SET CONTAINER = XEPDB1;

CREATE OR REPLACE VIEW smartmove_database.web_admin_login AS
SELECT user_id, email, password_hash
FROM smartmove_database.app_users
WHERE role = 'ADMIN';

ALTER SESSION SET CURRENT_SCHEMA = SMARTMOVE_DATABASE;
@@03_management_operations.sql
@@03_trip_operations.sql
ALTER SESSION SET CURRENT_SCHEMA = SYS;

GRANT SELECT ON smartmove_database.web_admin_login TO smartmove_database_app;
GRANT SELECT ON smartmove_database.app_users TO smartmove_database_app;
GRANT SELECT ON smartmove_database.passengers TO smartmove_database_app;
GRANT SELECT ON smartmove_database.drivers TO smartmove_database_app;
GRANT SELECT ON smartmove_database.maintenance_records TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.add_route TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.update_route TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.delete_route TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.add_vehicle TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.update_vehicle TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.delete_vehicle TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.add_driver TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.update_driver TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.delete_driver TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.schedule_trip TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.reschedule_trip TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.complete_trip TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.delete_trip TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.update_passenger TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.schedule_maintenance TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.update_maintenance TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.complete_maintenance TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.delete_maintenance TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.record_payment TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.process_refund TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.cancel_trip TO smartmove_database_app;
