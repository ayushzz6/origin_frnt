export const dynamic = "force-dynamic";

import ConnectHome from "@/components/connect/ConnectHome";

import { gateConnectStudent } from "./_gate";

export default async function ConnectPage() {
  await gateConnectStudent();
  return <ConnectHome />;
}
