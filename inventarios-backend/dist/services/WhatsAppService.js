"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = void 0;
const logger_1 = require("../utils/logger");
class WhatsAppService {
    apiUrl;
    token;
    enabled;
    constructor() {
        // Configuración harcodeada temporalmente para pruebas, luego mover a .env
        this.apiUrl = 'https://graph.facebook.com/v19.0/335894526282507/messages';
        this.token = 'EAAGacaATjwEBOZBgqhohcVk1ZBGEAbiTl7i86qESvSPjdllaomwzIG7LmOOvyTFpzyIlXX6dtTYTVTLLuw6SjaLoh2rec07I8qu1nGNYSVZAmQTGNa3QCQjujTqfd7QuLLwFNQllnX2z1V7JvToDhEi5KVqUWXHSqgSETvGyU7S2SN2fpXW0NpQaRI48pwZAgGS7A1BQMjLl5ZBjy';
        this.enabled = true; // Habilitado por defecto con las credenciales provistas
    }
    /**
     * Enviar plantilla de WhatsApp
     */
    async sendTemplate(phoneNumber, templateName, components = []) {
        if (!this.enabled) {
            logger_1.logger.info(`[WhatsApp] Disabled. Would send to ${phoneNumber}`);
            return { success: false, error: 'Disabled' };
        }
        try {
            const payload = {
                messaging_product: "whatsapp",
                to: phoneNumber,
                type: "template",
                template: {
                    name: templateName,
                    language: { code: "en_US" }
                }
            };
            // Only add components if they are not empty
            if (components && components.length > 0) {
                payload.template.components = components;
            }
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const responseData = await response.json();
            if (!response.ok) {
                // Extract useful error info
                const errorDetails = responseData?.error?.message || JSON.stringify(responseData);
                logger_1.logger.error('[WhatsApp] API Error:', errorDetails);
                return { success: false, error: errorDetails };
            }
            const messageId = responseData?.messages?.[0]?.id;
            logger_1.logger.info(`[WhatsApp] Message sent to ${phoneNumber}: ID ${messageId}`);
            return { success: true, messageId };
        }
        catch (error) {
            const errMsg = error.message || String(error);
            logger_1.logger.error('[WhatsApp] Error sending message:', errMsg);
            return { success: false, error: errMsg };
        }
    }
    /**
     * Enviar alerta de conteo con diferencias significativas
     * Usa la plantilla 'ga_notificarchofer' como base por ahora
     */
    async sendCountAlert(phoneNumbers, alertData) {
        let sent = 0;
        let failed = 0;
        const details = [];
        // Construir el cuerpo del mensaje
        const messageBody = this.buildCountAlertMessage(alertData);
        // Estructura con parámetros
        const componentsWithParams = [
            {
                type: "body",
                parameters: [
                    {
                        type: "text",
                        text: messageBody.substring(0, 1024)
                    }
                ]
            }
        ];
        logger_1.logger.info(`[WhatsApp] Sending alert for count ${alertData.folio} to ${phoneNumbers.length} numbers`);
        for (const phoneNumber of phoneNumbers) {
            const cleanNumber = phoneNumber.replace(/\D/g, '');
            let finalNumber = cleanNumber;
            if (finalNumber.length === 10) {
                finalNumber = '52' + finalNumber;
            }
            // Intento 1: Con parámetros
            let result = await this.sendTemplate(finalNumber, 'ga_notificarchofer', componentsWithParams);
            // Intento 2 (Fallback): Sin parámetros (si la plantilla no los acepta)
            if (!result.success) {
                logger_1.logger.warn(`[WhatsApp] Failed with params for ${finalNumber}. Retrying without params...`);
                const retryResult = await this.sendTemplate(finalNumber, 'ga_notificarchofer', []);
                if (retryResult.success) {
                    result = {
                        success: true,
                        messageId: retryResult.messageId,
                        error: `Sent without params (Initial error: ${result.error})`
                    };
                }
                else {
                    // Update error to show both failures
                    result.error = `1. With params: ${result.error} | 2. No params: ${retryResult.error}`;
                }
            }
            details.push({
                number: finalNumber,
                originalNumber: phoneNumber,
                success: result.success,
                error: result.error
            });
            if (result.success) {
                sent++;
            }
            else {
                failed++;
            }
        }
        return { sent, failed, details };
    }
    /**
     * Construir mensaje de texto para insertar en la plantilla
     */
    buildCountAlertMessage(data) {
        const lines = [
            `ALERTA INVENTARIO`,
            `Conteo: ${data.folio}`,
            `Sucursal: ${data.branchName}`,
            `Línea: ${data.lineName}`,
            ``,
            `Diferencias encontradas:`
        ];
        // Agregar artículos (limitado para no exceder límites de parámetros)
        data.itemsWithDifferences.forEach((item, index) => {
            if (index < 5) {
                lines.push(`- ${item.itemCode}: ${item.expected} vs ${item.counted} (Diff: ${item.difference})`);
            }
        });
        if (data.itemsWithDifferences.length > 5) {
            lines.push(`... y ${data.itemsWithDifferences.length - 5} más.`);
        }
        return lines.join('\n');
    }
}
exports.whatsappService = new WhatsAppService();
//# sourceMappingURL=WhatsAppService.js.map