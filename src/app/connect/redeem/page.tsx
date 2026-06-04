export const dynamic = "force-dynamic";

import { ConnectRedeemPanel } from "@/components/connect/ConnectRedeemPanel";

import { gateConnectStudent } from "../_gate";

export default async function ConnectRedeemPage() {
  await gateConnectStudent();
  return (
    <div className="container mx-auto max-w-2xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Redeem an institute code</h1>
        <p className="text-sm text-muted-foreground">
          Connect to your coaching institute and unlock one Origin subject.
        </p>
      </div>
      <ConnectRedeemPanel />
    </div>
  );
}
