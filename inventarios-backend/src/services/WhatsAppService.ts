import { logger } from '../utils/logger'

/**
 * Servicio para enviar notificaciones por WhatsApp
 * Integrado con API de Meta
 */

interface CountAlertData {
    folio: string
    branchName: string
    lineCode: string
    lineName: string
    itemsWithDifferences: Array<{
        itemCode: string
        description: string
        expected: number
        counted: number
        difference: number
        differencePercentage: number
    }>
}

class WhatsAppService {
    private apiUrl: string
    private token: string
    private enabled: boolean

    constructor() {
        // Configuración harcodeada temporalmente para pruebas, luego mover a .env
        this.apiUrl = 'https://graph.facebook.com/v19.0/335894526282507/messages'
        this.token = 'EAAGacaATjwEBOZBgqhohcVk1ZBGEAbiTl7i86qESvSPjdllaomwzIG7LmOOvyTFpzyIlXX6dtTYTVTLLuw6SjaLoh2rec07I8qu1nGNYSVZAmQTGNa3QCQjujTqfd7QuLLwFNQllnX2z1V7JvToDhEi5KVqUWXHSqgSETvGyU7S2SN2fpXW0NpQaRI48pwZAgGS7A1BQMjLl5ZBjy'
        this.enabled = true // Habilitado por defecto con las credenciales provistas
    }

    /**
     * Enviar plantilla de WhatsApp
     */
    async sendTemplate(phoneNumber: string, templateName: string, components: any[] = []): Promise<{ success: boolean; error?: any; messageId?: string }> {
        if (!this.enabled) {
            logger.info(`[WhatsApp] Disabled. Would send to ${phoneNumber}`)
            return { success: false, error: 'Disabled' }
        }

        try {
            const payload: any = {
                messaging_product: "whatsapp",
                to: phoneNumber,
                type: "template",
                template: {
                    name: templateName,
                    language: { code: "es_MX" }
                }
            }

            // Only add components if they are not empty
            if (components && components.length > 0) {
                payload.template.components = components
            }

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })

            const responseData: any = await response.json()

            if (!response.ok) {
                // Extract useful error info
                const errorDetails = responseData?.error?.message || JSON.stringify(responseData)
                logger.error('[WhatsApp] API Error:', errorDetails)
                return { success: false, error: errorDetails }
            }

            const messageId = responseData?.messages?.[0]?.id
            logger.info(`[WhatsApp] Message sent to ${phoneNumber}: ID ${messageId}`)
            return { success: true, messageId }
        } catch (error: any) {
            const errMsg = error.message || String(error)
            logger.error('[WhatsApp] Error sending message:', errMsg)
            return { success: false, error: errMsg }
        }
    }

    /**
     * Enviar alerta de conteo con diferencias significativas
     * Usa la plantilla 'ga_notificarchofer' como base por ahora
     */
    async sendCountAlert(
        phoneNumbers: string[],
        alertData: CountAlertData
    ): Promise<{ sent: number; failed: number; details: any[] }> {
        let sent = 0
        let failed = 0
        const details: any[] = []

        // Construir el cuerpo del mensaje
        const messageBody = this.buildCountAlertMessage(alertData)

        const componentsWithParams = [
            {
                type: "body",
                parameters: [
                    { type: "text", text: alertData.folio },
                    { type: "text", text: alertData.branchName },
                    { type: "text", text: alertData.lineName },
                    { type: "text", text: messageBody.substring(0, 1024) }
                ]
            }
        ]

        logger.info(`[WhatsApp] Sending alert for count ${alertData.folio} to ${phoneNumbers.length} numbers`)

        for (const phoneNumber of phoneNumbers) {
            const cleanNumber = phoneNumber.replace(/\D/g, '')
            let finalNumber = cleanNumber
            if (finalNumber.length === 10) {
                finalNumber = '52' + finalNumber
            }

            const result = await this.sendTemplate(finalNumber, 'inventario_alerta_linea', componentsWithParams)

            details.push({
                number: finalNumber,
                originalNumber: phoneNumber,
                success: result.success,
                error: result.error
            })

            if (result.success) {
                sent++
            } else {
                failed++
            }
        }

        return { sent, failed, details }
    }

    /**
     * Construir mensaje de texto para insertar en la plantilla
     */
    private buildCountAlertMessage(data: CountAlertData): string {
        const lines = [
            `ALERTA INVENTARIO`,
            `Conteo: ${data.folio}`,
            `Sucursal: ${data.branchName}`,
            `Línea: ${data.lineName}`,
            ``,
            `Diferencias encontradas:`
        ]

        // Agregar artículos (limitado para no exceder límites de parámetros)
        data.itemsWithDifferences.forEach((item, index) => {
            if (index < 5) {
                lines.push(
                    `- ${item.itemCode}: ${item.expected} vs ${item.counted} (Diff: ${item.difference})`
                )
            }
        })

        if (data.itemsWithDifferences.length > 5) {
            lines.push(`... y ${data.itemsWithDifferences.length - 5} más.`)
        }

        return lines.join('\n')
    }
}

export const whatsappService = new WhatsAppService()
export type { CountAlertData }
