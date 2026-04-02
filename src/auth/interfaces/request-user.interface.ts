import { UserRole } from '../enums/user-role.enum';

export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
}
