export type NotificationType = 'request_comment' | 'request_status' | 'bulk_request_comment' | 'bulk_request_status';
export type NotificationEntityType = 'request' | 'bulk_request';
export interface NotificationRow {
    id: number;
    user_id: number;
    actor_user_id: number | null;
    actor_name?: string | null;
    type: NotificationType;
    entity_type: NotificationEntityType;
    entity_id: number;
    title: string;
    body: string | null;
    link: string;
    is_read: boolean;
    created_at: string;
}
export declare class InAppNotificationsService {
    private pool;
    getRequestRecipients(requestId: number, excludeUserId: number): Promise<number[]>;
    getBulkRequestRecipients(bulkRequestId: number, excludeUserId: number): Promise<number[]>;
    notify(recipients: number[], data: {
        actor_user_id: number | null;
        type: NotificationType;
        entity_type: NotificationEntityType;
        entity_id: number;
        title: string;
        body?: string | null;
        link: string;
    }): Promise<void>;
    list(userId: number, limit?: number): Promise<{
        notifications: NotificationRow[];
        unread_count: number;
    }>;
    markRead(userId: number, id: number): Promise<void>;
    markAllRead(userId: number): Promise<void>;
    markReadForEntity(userId: number, entityType: NotificationEntityType, entityId: number): Promise<void>;
}
export declare const inAppNotificationsService: InAppNotificationsService;
export default InAppNotificationsService;
//# sourceMappingURL=InAppNotificationsService.d.ts.map