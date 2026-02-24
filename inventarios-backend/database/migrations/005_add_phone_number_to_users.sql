-- Migration 005: Add phone_number to users
-- Adds a field to store phone numbers for notifications (WhatsApp)

USE inventarios;

ALTER TABLE users 
ADD COLUMN phone_number VARCHAR(20) DEFAULT NULL AFTER status;

-- Optional: Update existing users if needed (legacy placeholder)
-- UPDATE users SET phone_number = '521234567890' WHERE email = 'admin@inventarios.com';
