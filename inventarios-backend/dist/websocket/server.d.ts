import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
/**
 * Inicializa el servidor WebSocket
 */
export declare const initializeWebSocket: (httpServer: HTTPServer) => SocketIOServer;
/**
 * Obtiene la instancia del servidor WebSocket
 */
export declare const getWebSocketServer: () => SocketIOServer | null;
/**
 * Emite un evento de actualización de stock
 */
export declare const emitStockUpdate: (branchId: number, itemCode: string, oldStock: number, newStock: number) => void;
/**
 * Emite un evento de progreso de conteo
 */
export declare const emitCountProgress: (countId: number, folio: string, totalItems: number, countedItems: number) => void;
/**
 * Emite un evento de cambio de estado de solicitud
 */
export declare const emitRequestStatus: (requestId: number, folio: string, oldStatus: string, newStatus: string) => void;
/**
 * Emite un evento cuando se crea una nueva solicitud
 */
export declare const emitRequestCreated: (request: any) => void;
/**
 * Emite un evento cuando se crea un nuevo conteo
 */
export declare const emitCountCreated: (count: any) => void;
/**
 * Emite un evento cuando cambia el estado de un conteo
 */
export declare const emitCountStatusChanged: (countId: number, folio: string, oldStatus: string, newStatus: string) => void;
/**
 * Emite un evento cuando se agrega un detalle a un conteo
 */
export declare const emitCountDetailAdded: (countId: number, detail: any) => void;
/**
 * Emite un evento personalizado a una sala específica
 */
export declare const emitToRoom: (room: string, event: string, data: any) => void;
/**
 * Emite un evento a un usuario específico
 */
export declare const emitToUser: (userId: number, event: string, data: any) => void;
/**
 * Emite un evento a todos los usuarios con un rol específico
 */
export declare const emitToRole: (roleId: number, event: string, data: any) => void;
/**
 * Emite un evento cuando se reasigna un conteo
 */
export declare const emitCountReassigned: (countId: number, folio: string, oldResponsibleId: number, newResponsibleId: number) => void;
declare const _default: {
    initializeWebSocket: (httpServer: HTTPServer) => SocketIOServer;
    getWebSocketServer: () => SocketIOServer | null;
    emitStockUpdate: (branchId: number, itemCode: string, oldStock: number, newStock: number) => void;
    emitCountProgress: (countId: number, folio: string, totalItems: number, countedItems: number) => void;
    emitRequestStatus: (requestId: number, folio: string, oldStatus: string, newStatus: string) => void;
    emitRequestCreated: (request: any) => void;
    emitCountCreated: (count: any) => void;
    emitCountStatusChanged: (countId: number, folio: string, oldStatus: string, newStatus: string) => void;
    emitCountDetailAdded: (countId: number, detail: any) => void;
    emitCountReassigned: (countId: number, folio: string, oldResponsibleId: number, newResponsibleId: number) => void;
    emitToRoom: (room: string, event: string, data: any) => void;
    emitToUser: (userId: number, event: string, data: any) => void;
    emitToRole: (roleId: number, event: string, data: any) => void;
};
export default _default;
//# sourceMappingURL=server.d.ts.map