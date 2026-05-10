import { redirect } from 'next/navigation';

import { getServerUser } from '@/lib/auth-server';
import CreateStudyRoomClient from './_client';

export default async function CreateStudyRoomPage() {
  const user = await getServerUser();
  if (!user) redirect('/');
  return <CreateStudyRoomClient />;
}
