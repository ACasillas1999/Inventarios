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
        const components = [
            {
                type: "body",
                parameters: [
                    { type: "text", text: userName },
                    { type: "text", text: folio },
                    { type: "text", text: branchName },
                    { type: "text", text: String(itemsCount) }
                ]
            }
        ];
        await this.sendWhatsApp(phoneNumber, 'inventario_conteo_asignado', components, 'ASSIGNMENT', userName);
    }
    /**
     * Envía una notificación de reasignación
     */
    async sendReassignmentNotification(userName, phoneNumber, folio, branchName, itemsCount) {
        if (!phoneNumber)
            return;
        const components = [
            {
                type: "body",
                parameters: [
                    { type: "text", text: userName },
                    { type: "text", text: folio },
                    { type: "text", text: branchName },
                    { type: "text", text: String(itemsCount) }
                ]
            }
        ];
        await this.sendWhatsApp(phoneNumber, 'inventario_conteo_asignado', components, 'REASSIGNMENT', userName);
    }
    /**
     * Notifica a los suscriptores cuando un conteo es finalizado
     */
    async notifyCountFinished(folio, branchName, branchId, userName) {
        const subscribers = await this.getSubscribers('count_finished', branchId);
        for (const sub of subscribers) {
            const components = [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: folio },
                        { type: "text", text: branchName },
                        { type: "text", text: userName }
                    ]
                }
            ];
            await this.sendWhatsApp(sub.phone_number, 'inventario_conteo_finalizado', components, 'COUNT_FINISHED', sub.name);
        }
    }
    /**
     * Notifica a los suscriptores cuando se crea una solicitud de ajuste/diferencia
     */
    async notifyRequestCreated(folio, branchName, branchId, itemCode, difference, userName, type = 'count') {
        const subscribers = await this.getSubscribers('request_created', branchId);
        for (const sub of subscribers) {
            const components = [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: branchName },
                        { type: "text", text: itemCode },
                        { type: "text", text: String(difference) },
                        { type: "text", text: userName },
                        { type: "text", text: type === 'count' ? `Conteo ${folio}` : (type === 'migracion' ? 'Migración' : 'Ajuste Directo') }
                    ]
                }
            ];
            await this.sendWhatsApp(sub.phone_number, 'inventario_solicitud_ajuste', components, 'REQUEST_CREATED', sub.name);
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
    async sendWhatsApp(to, templateName, components, context, userName) {
        if (!to)
            return;
        const cleanPhone = to.replace(/\D/g, '');
        let finalNumber = cleanPhone;
        if (finalNumber.length === 10) {
            finalNumber = '52' + finalNumber;
        }
        try {
            await WhatsAppService_1.whatsappService.sendTemplate(finalNumber, templateName, components);
            logger_1.logger.info(`[NotificationService] Template ${templateName} sent to ${userName || finalNumber} for context ${context}`);
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