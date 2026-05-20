import { TeacherOnboardingForm } from "@/components/teacher/TeacherOnboardingForm";
import { getServerUser } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function TeacherOnboardingPage() {
  const user = await getServerUser();
  if (!user) redirect("/auth?next=/teacher/onboarding");
  if (user.role !== "teacher" && user.role !== "admin") {
    redirect("/dashboard");
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Set up your workspace</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Pick how you want to use Origin. You can change details later in workspace settings.
        </p>
      </header>
      <TeacherOnboardingForm />
    </div>
  );
}
