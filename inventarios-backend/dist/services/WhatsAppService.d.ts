interface CountAlertData {
    folio: string;
    branchName: string;
    lineCode: string;
    lineName: string;
    itemsWithDifferences: Array<{
        itemCode: string;
        description: string;
        expected: number;
        counted: number;
        difference: number;
        differencePercentage: number;
    }>;
}
declare class WhatsAppService {
    private apiUrl;
    private token;
    private enabled;
    constructor();
    /**
     * Enviar plantilla de WhatsApp
     */
    sendTemplate(phoneNumber: string, templateName: string, components?: any[]): Promise<{
        success: boolean;
        error?: any;
        messageId?: string;
    }>;
    /**
     * Enviar alerta de conteo con diferencias significativas
     * Usa la plantilla 'ga_notificarchofer' como base por ahora
     */
    sendCountAlert(phoneNumbers: string[], alertData: CountAlertData): Promise<{
        sent: number;
        failed: number;
        details: any[];
    }>;
    /**
     * Construir mensaje de texto para insertar en la plantilla
     */
    private buildCountAlertMessage;
}
export declare const whatsappService: WhatsAppService;
export type { CountAlertData };
//# sourceMappingURL=WhatsAppService.d.ts.map