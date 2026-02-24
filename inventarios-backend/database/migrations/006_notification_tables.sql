-- Tablas para personalización de flujo de notificaciones

CREATE TABLE IF NOT EXISTS notification_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_key VARCHAR(50) UNIQUE NOT NULL, -- 'count_assigned', 'count_finished', 'request_created'
    description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS notification_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    event_key VARCHAR(50) NOT NULL,
    branch_id INT DEFAULT NULL, -- NULL significa todas las sucursales
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_key) REFERENCES notification_events(event_key)
);

-- Insertar eventos base
INSERT IGNORE INTO notification_events (event_key, description) VALUES 
('count_assigned', 'Notificar al responsable cuando se le asigna un conteo'),
('count_finished', 'Notificar a jefes cuando un surtidor termina un conteo'),
('request_created', 'Notificar a inventarios cuando se crean solicitudes de ajuste');
