export const dynamic = "force-dynamic";

import ConnectHome from "@/components/connect/ConnectHome";

import { gateConnectStudent } from "../_gate";

export default async function ConnectCollaboratorsPage() {
  await gateConnectStudent();
  return <ConnectHome defaultTab="browse" />;
}
