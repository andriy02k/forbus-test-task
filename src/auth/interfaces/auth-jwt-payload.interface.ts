import { UserRole } from '../enums/user-role.enum';

export interface AuthJwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
}
