-- Existing installations only. Run as SMARTMOVE_DATABASE in XEPDB1 after
-- scripts/migrate-browser-auth.mjs --prepare and verification of bearer auth.
-- Preserve NOTIFICATIONS_START_AT and AUTH_TOKEN_SECRET in website/.env.local.
-- DDL commits immediately. Back up these tables first; existing logins expire.
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

BEGIN
    IF SYS_CONTEXT('USERENV', 'CON_NAME') <> 'XEPDB1'
       OR SYS_CONTEXT('USERENV', 'CURRENT_USER') <> 'SMARTMOVE_DATABASE' THEN
        RAISE_APPLICATION_ERROR(-20999, 'Connect as SMARTMOVE_DATABASE in XEPDB1.');
    END IF;
END;
/

DROP TABLE smartmove_database.web_sessions;
DROP TABLE smartmove_database.web_admin_sessions;
DROP TABLE smartmove_database.web_notification_baseline;
