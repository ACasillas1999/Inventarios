import { UserResponse } from '../types';
export interface CreateUserData {
    name: string;
    email: string;
    password: string;
    role_id?: number;
    branch_id?: number;
    branch_ids?: number[];
}
export declare class UsersService {
    private pool;
    getAll(): Promise<Array<Pick<UserResponse, 'id' | 'name' | 'email' | 'role_id' | 'status'>>>;
    create(data: CreateUserData): Promise<UserResponse>;
    updateStatus(userId: number, status: string): Promise<void>;
    changePassword(userId: number, newPassword: string): Promise<void>;
}
export default UsersService;
//# sourceMappingURL=UsersService.d.ts.map