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
        ]

        await this.sendWhatsApp(phoneNumber, 'inventario_conteo_asignado', components, 'ASSIGNMENT', userName)
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
        ]

        await this.sendWhatsApp(phoneNumber, 'inventario_conteo_asignado', components, 'REASSIGNMENT', userName)
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
            const components = [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: folio },
                        { type: "text", text: branchName },
                        { type: "text", text: userName }
                    ]
                }
            ]

            await this.sendWhatsApp(sub.phone_number, 'inventario_conteo_finalizado', components, 'COUNT_FINISHED', sub.name)
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
            const components = [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: branchName },
                        { type: "text", text: itemCode },
                        { type: "text", text: String(difference) },
                        { type: "text", text: userName },
                        { type: "text", text: type === 'count' ? `Conteo ${folio}` : 'Directo' }
                    ]
                }
            ]

            await this.sendWhatsApp(sub.phone_number, 'inventario_solicitud_ajuste', components, 'REQUEST_CREATED', sub.name)
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
    private async sendWhatsApp(to: string | null | undefined, templateName: string, components: any[], context: string, userName?: string): Promise<void> {
        if (!to) return

        const cleanPhone = to.replace(/\D/g, '')
        let finalNumber = cleanPhone
        if (finalNumber.length === 10) {
            finalNumber = '52' + finalNumber
        }

        try {
            await whatsappService.sendTemplate(finalNumber, templateName, components)
            logger.info(`[NotificationService] Template ${templateName} sent to ${userName || finalNumber} for context ${context}`)
        } catch (error) {
            logger.error(`[NotificationService] Error sending via WhatsAppService:`, error)
        }
    }
}

export const notificationService = new NotificationService()
export default notificationService
