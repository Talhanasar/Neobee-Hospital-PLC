import { getSessionContext } from '@/lib/auth';
import NavPills from './NavPills';

type Props = { session: Awaited<ReturnType<typeof getSessionContext>> };

export default async function SiteHeader({ session }: Props) {
  return (
    <NavPills
      auth={{
        loggedIn: session.user !== null,
        dashboardHref: session.isStaff ? '/admin' : '/portal',
      }}
    />
  );
}
