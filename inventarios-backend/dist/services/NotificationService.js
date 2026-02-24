"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../config/database");
const WhatsAppService_1 = require("./WhatsAppService");
class NotificationService {
    /**
     * Envía una notificación de asignación de conteo
     */
    async sendAssignmentNotification(userName, phoneNumber, folio, branchName, itemsCount) {
        if (!phoneNumber) {
            logger_1.logger.warn(`Cannot send notification to ${userName}: No phone number provided`);
            return;
        }
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            logger_1.logger.warn(`Invalid phone number for ${userName}: ${phoneNumber}`);
            return;
        }
        const message = `Hola ${userName}, se te ha asignado un nuevo conteo de inventario:
📦 *Folio:* ${folio}
🏢 *Sucursal:* ${branchName}
🔢 *Artículos:* ${itemsCount}
    
Por favor ingresa al sistema para comenzar la captura.`;
        // TODO: En el futuro, cambiar 'ga_notificarchofer' por la plantilla aprobada para 'count_assigned'
        await this.sendWhatsApp(phoneNumber, message, 'ASSIGNMENT', userName);
    }
    /**
     * Envía una notificación de reasignación
     */
    async sendReassignmentNotification(userName, phoneNumber, folio, branchName, itemsCount) {
        if (!phoneNumber)
            return;
        const message = `Hola ${userName}, se te ha reasignado el conteo de inventario:
📦 *Folio:* ${folio}
🏢 *Sucursal:* ${branchName}
🔢 *Artículos:* ${itemsCount}
    
Ya puedes continuar con la captura desde donde se dejó.`;
        // TODO: En el futuro, cambiar 'ga_notificarchofer' por la plantilla aprobada para 'count_reassigned'
        await this.sendWhatsApp(phoneNumber, message, 'REASSIGNMENT', userName);
    }
    /**
     * Notifica a los suscriptores cuando un conteo es finalizado
     */
    async notifyCountFinished(folio, branchName, branchId, userName) {
        const subscribers = await this.getSubscribers('count_finished', branchId);
        for (const sub of subscribers) {
            const message = `✅ *Conteo Finalizado*
📦 *Folio:* ${folio}
🏢 *Sucursal:* ${branchName}
👤 *Capturó:* ${userName}
    
El surtidor ha terminado de contar todos los artículos.`;
            await this.sendWhatsApp(sub.phone_number, message, 'COUNT_FINISHED', sub.name);
        }
    }
    /**
     * Notifica a los suscriptores cuando se crea una solicitud de ajuste/diferencia
     */
    async notifyRequestCreated(folio, branchName, branchId, itemCode, difference, userName, type = 'count') {
        const subscribers = await this.getSubscribers('request_created', branchId);
        for (const sub of subscribers) {
            const message = `⚠️ *Nueva Solicitud de Ajuste*
🏢 *Sucursal:* ${branchName}
🆔 *Código:* ${itemCode}
🔢 *Diferencia:* ${difference}
👤 *Solicitó:* ${userName}
📂 *Origen:* ${type === 'count' ? `Conteo ${folio}` : 'Directo'}
    
Se requiere revisión para esta diferencia.`;
            await this.sendWhatsApp(sub.phone_number, message, 'REQUEST_CREATED', sub.name);
        }
    }
    /**
     * Obtiene los usuarios suscritos a un evento específico
     */
    async getSubscribers(eventKey, branchId) {
        const pool = (0, database_1.getLocalPool)();
        const [rows] = await pool.execute(`SELECT u.name, u.phone_number 
             FROM users u
             JOIN notification_subscriptions ns ON u.id = ns.user_id
             WHERE ns.event_key = ? 
             AND (ns.branch_id IS NULL OR ns.branch_id = ?)
             AND u.status = 'active'
             AND u.phone_number IS NOT NULL`, [eventKey, branchId]);
        return rows;
    }
    /**
     * Centralización del envío vía WhatsAppService (Meta API)
     */
    async sendWhatsApp(to, message, context, userName) {
        if (!to)
            return;
        const cleanPhone = to.replace(/\D/g, '');
        let finalNumber = cleanPhone;
        if (finalNumber.length === 10) {
            finalNumber = '52' + finalNumber;
        }
        // Estructura de componentes para la plantilla (Usa la genérica por ahora)
        const components = [
            {
                type: "body",
                parameters: [
                    {
                        type: "text",
                        text: message.substring(0, 1024)
                    }
                ]
            }
        ];
        try {
            // Por ahora usamos 'ga_notificarchofer' como plantilla base que acepta 1 parámetro (el texto completo)
            // Cuando el usuario tenga sus plantillas específicas, se cambiará esto por el nombre correcto.
            await WhatsAppService_1.whatsappService.sendTemplate(finalNumber, 'ga_notificarchofer', components);
            logger_1.logger.info(`[NotificationService] Message sent to ${userName || finalNumber} for context ${context}`);
        }
        catch (error) {
            logger_1.logger.error(`[NotificationService] Error sending via WhatsAppService:`, error);
        }
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
exports.default = exports.notificationService;
//# sourceMappingURL=NotificationService.js.map