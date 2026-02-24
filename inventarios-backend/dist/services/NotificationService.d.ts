export interface WhatsAppPayload {
    to: string;
    message: string;
}
export declare class NotificationService {
    /**
     * Envía una notificación de asignación de conteo
     */
    sendAssignmentNotification(userName: string, phoneNumber: string | null | undefined, folio: string, branchName: string, itemsCount: number): Promise<void>;
    /**
     * Envía una notificación de reasignación
     */
    sendReassignmentNotification(userName: string, phoneNumber: string | null | undefined, folio: string, branchName: string, itemsCount: number): Promise<void>;
    /**
     * Notifica a los suscriptores cuando un conteo es finalizado
     */
    notifyCountFinished(folio: string, branchName: string, branchId: number, userName: string): Promise<void>;
    /**
     * Notifica a los suscriptores cuando se crea una solicitud de ajuste/diferencia
     */
    notifyRequestCreated(folio: string, branchName: string, branchId: number, itemCode: string, difference: number, userName: string, type?: 'count' | 'direct'): Promise<void>;
    /**
     * Obtiene los usuarios suscritos a un evento específico
     */
    private getSubscribers;
    /**
     * Centralización del envío vía WhatsAppService (Meta API)
     */
    private sendWhatsApp;
}
export declare const notificationService: NotificationService;
export default notificationService;
//# sourceMappingURL=NotificationService.d.ts.map