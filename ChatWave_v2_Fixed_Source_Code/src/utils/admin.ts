export const ADMIN_USERNAMES = ['shreyprajapati11'];
export const ADMIN_UIDS = ['Uc0Pb3efqxgRGDIjEenloqH9TF92'];

export interface AdminStats {
  totalUsers: number;
  onlineUsers: number;
  totalStories: number;
  totalReports: number;
}

/**
 * Checks whether a given user object has platform administrator privileges.
 */
export function isAdmin(userProfile?: any, authUser?: any): boolean {
  if (!userProfile && !authUser) return false;

  if (userProfile?.role === 'admin') return true;

  const username = (userProfile?.username || '').toLowerCase().trim();
  if (username && ADMIN_USERNAMES.includes(username)) return true;

  const uid = userProfile?.uid || authUser?.uid;
  if (uid && ADMIN_UIDS.includes(uid)) return true;

  return false;
}
