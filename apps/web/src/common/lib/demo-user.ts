import { User } from "@/common/lib/api";

export const DEMO_USER_EMAIL = "test@test.com";
export const DEMO_LOGIN_EMAIL = "Test@Test.com";
export const DEMO_LOGIN_PASSWORD = "test123";

export function isDemoUser(user: Pick<User, "email"> | null | undefined): boolean {
  return user?.email.toLowerCase() === DEMO_USER_EMAIL;
}
