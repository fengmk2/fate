export default function isAdmin({ role }: { role: string }): boolean {
  return role.split(',').includes('admin');
}
