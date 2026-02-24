import { UserResponse } from '../types';
export interface CreateUserData {
    name: string;
    email: string;
    password: string;
    role_id?: number;
    branch_id?: number;
    branch_ids?: number[];
    phone_number?: string;
}
export declare class UsersService {
    private pool;
    getAll(): Promise<UserResponse[]>;
    create(data: CreateUserData): Promise<UserResponse>;
    getUserById(id: number): Promise<UserResponse>;
    updateStatus(userId: number, status: string): Promise<void>;
    changePassword(userId: number, newPassword: string): Promise<void>;
    update(id: number, data: Partial<CreateUserData> & {
        status?: string;
    }): Promise<UserResponse>;
    updateSubscriptions(userId: number, subscriptions: Array<{
        event_key: string;
        branch_id: number | null;
    }>): Promise<void>;
}
export default UsersService;
//# sourceMappingURL=UsersService.d.ts.map