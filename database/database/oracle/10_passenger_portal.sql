WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
ALTER SESSION SET CONTAINER = XEPDB1;

CREATE TABLE smartmove_database.web_notification_baseline (
    baseline_id NUMBER PRIMARY KEY CHECK (baseline_id = 1),
    started_at DATE NOT NULL
);
INSERT INTO smartmove_database.web_notification_baseline VALUES (1, SYSDATE);

GRANT SELECT ON smartmove_database.web_passenger_login TO smartmove_database_app;
GRANT SELECT ON smartmove_database.payments TO smartmove_database_app;
GRANT SELECT ON smartmove_database.refunds TO smartmove_database_app;
GRANT SELECT ON smartmove_database.feedback_records TO smartmove_database_app;
GRANT SELECT ON smartmove_database.booking_status_history TO smartmove_database_app;
GRANT SELECT ON smartmove_database.web_notification_baseline TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_cancel_booking TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_update_profile TO smartmove_database_app;
GRANT EXECUTE ON smartmove_database.web_submit_feedback TO smartmove_database_app;

COMMIT;
