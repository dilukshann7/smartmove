CREATE USER smartmove_database IDENTIFIED BY ChangeOwner123
DEFAULT TABLESPACE users TEMPORARY TABLESPACE temp
QUOTA 20M ON users
ACCOUNT UNLOCK;

CREATE USER smartmove_database_app IDENTIFIED BY ChangeApp123;

GRANT CREATE SESSION, CREATE TABLE, CREATE PROCEDURE,
      CREATE TRIGGER, CREATE VIEW TO smartmove_database;
GRANT CREATE SESSION TO smartmove_database_app;
GRANT CREATE SESSION TO smartmove_database_report;

CREATE ROLE smartmove_database_reporting NOT IDENTIFIED;
GRANT smartmove_database_reporting TO smartmove_database_report;
