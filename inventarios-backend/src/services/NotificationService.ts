import { logger } from '../utils/logger'
import { getLocalPool } from '../config/database'
import { RowDataPacket } from 'mysql2/promise'
import { whatsappService } from './WhatsAppService'

export interface WhatsAppPayload {
    to: string
    message: string
}

export class NotificationService {
    /**
     * Envía una notificación de asignación de conteo
     */
    async sendAssignmentNotification(
        userName: string,
        phoneNumber: string | null | undefined,
        folio: string,
        branchName: string,
        itemsCount: number
    ): Promise<void> {
        if (!phoneNumber) {
            logger.warn(`Cannot send notification to ${userName}: No phone number provided`)
            return
        }

        const cleanPhone = phoneNumber.replace(/\D/g, '')
        if (cleanPhone.length < 10) {
            logger.warn(`Invalid phone number for ${userName}: ${phoneNumber}`)
            return
        }

        const message = `Hola ${userName}, se te ha asignado un nuevo conteo de inventario:
📦 *Folio:* ${folio}
🏢 *Sucursal:* ${branchName}
🔢 *Artículos:* ${itemsCount}
    
Por favor ingresa al sistema para comenzar la captura.`

        // TODO: En el futuro, cambiar 'ga_notificarchofer' por la plantilla aprobada para 'count_assigned'
        await this.sendWhatsApp(phoneNumber, message, 'ASSIGNMENT', userName)
    }

    /**
     * Envía una notificación de reasignación
     */
    async sendReassignmentNotification(
        userName: string,
        phoneNumber: string | null | undefined,
        folio: string,
        branchName: string,
        itemsCount: number
    ): Promise<void> {
        if (!phoneNumber) return

        const message = `Hola ${userName}, se te ha reasignado el conteo de inventario:
📦 *Folio:* ${folio}
🏢 *Sucursal:* ${branchName}
🔢 *Artículos:* ${itemsCount}
    
Ya puedes continuar con la captura desde donde se dejó.`

        // TODO: En el futuro, cambiar 'ga_notificarchofer' por la plantilla aprobada para 'count_reassigned'
        await this.sendWhatsApp(phoneNumber, message, 'REASSIGNMENT', userName)
    }

    /**
     * Notifica a los suscriptores cuando un conteo es finalizado
     */
    async notifyCountFinished(
        folio: string,
        branchName: string,
        branchId: number,
        userName: string
    ): Promise<void> {
        const subscribers = await this.getSubscribers('count_finished', branchId)

        for (const sub of subscribers) {
            const message = `✅ *Conteo Finalizado*
📦 *Folio:* ${folio}
🏢 *Sucursal:* ${branchName}
👤 *Capturó:* ${userName}
    
El surtidor ha terminado de contar todos los artículos.`

            await this.sendWhatsApp(sub.phone_number, message, 'COUNT_FINISHED', sub.name)
        }
    }

    /**
     * Notifica a los suscriptores cuando se crea una solicitud de ajuste/diferencia
     */
    async notifyRequestCreated(
        folio: string,
        branchName: string,
        branchId: number,
        itemCode: string,
        difference: number,
        userName: string,
        type: 'count' | 'direct' = 'count'
    ): Promise<void> {
        const subscribers = await this.getSubscribers('request_created', branchId)

        for (const sub of subscribers) {
            const message = `⚠️ *Nueva Solicitud de Ajuste*
🏢 *Sucursal:* ${branchName}
🆔 *Código:* ${itemCode}
🔢 *Diferencia:* ${difference}
👤 *Solicitó:* ${userName}
📂 *Origen:* ${type === 'count' ? `Conteo ${folio}` : 'Directo'}
    
Se requiere revisión para esta diferencia.`

            await this.sendWhatsApp(sub.phone_number, message, 'REQUEST_CREATED', sub.name)
        }
    }

    /**
     * Obtiene los usuarios suscritos a un evento específico
     */
    private async getSubscribers(eventKey: string, branchId: number): Promise<Array<{ name: string, phone_number: string }>> {
        const pool = getLocalPool()
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT u.name, u.phone_number 
             FROM users u
             JOIN notification_subscriptions ns ON u.id = ns.user_id
             WHERE ns.event_key = ? 
             AND (ns.branch_id IS NULL OR ns.branch_id = ?)
             AND u.status = 'active'
             AND u.phone_number IS NOT NULL`,
            [eventKey, branchId]
        )
        return rows as any[]
    }

    /**
     * Centralización del envío vía WhatsAppService (Meta API)
     */
    private async sendWhatsApp(to: string | null | undefined, message: string, context: string, userName?: string): Promise<void> {
        if (!to) return

        const cleanPhone = to.replace(/\D/g, '')
        let finalNumber = cleanPhone
        if (finalNumber.length === 10) {
            finalNumber = '52' + finalNumber
        }

        // Estructura de componentes para la plantilla (Usa la genérica por ahora)
        const components: any[] = [
            {
                type: "body",
                parameters: [
                    {
                        type: "text",
                        text: message.substring(0, 1024)
                    }
                ]
            }
        ]

        try {
            // Por ahora usamos 'ga_notificarchofer' como plantilla base que acepta 1 parámetro (el texto completo)
            // Cuando el usuario tenga sus plantillas específicas, se cambiará esto por el nombre correcto.
            await whatsappService.sendTemplate(finalNumber, 'ga_notificarchofer', components)

            logger.info(`[NotificationService] Message sent to ${userName || finalNumber} for context ${context}`)
        } catch (error) {
            logger.error(`[NotificationService] Error sending via WhatsAppService:`, error)
        }
    }
}

export const notificationService = new NotificationService()
export default notificationService
