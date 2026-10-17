-- Ticket references start at #1001, including after the table is emptied with RESTART IDENTITY
-- (tests do this), which resets a sequence to its START value.
ALTER SEQUENCE "support_tickets_number_seq" START WITH 1001;
