import Dashboard from "@/components/dashboard";
import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { adminIdentity, allInvitations, settings } from "@/lib/wedding-server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const identity = await adminIdentity();
  if (!identity.role) {
    return <main className="admin-shell">
      <section className="admin-card admin-login">
        <p className="eyebrow">Yile &amp; Enpei</p>
        <h2>Wedding dashboard</h2>
        <p>{identity.signedIn ? "This ChatGPT account doesn’t have access to the wedding dashboard." : "Sign in with the ChatGPT account authorized to manage this wedding."}</p>
        <a className="button" target="_top" href={identity.signedIn ? chatGPTSignOutPath("/admin") : chatGPTSignInPath("/admin")}>
          {identity.signedIn ? "Switch accounts" : "Sign in with ChatGPT"}
        </a>
        <p><a className="text-button" href="/">Back to the wedding site</a></p>
      </section>
    </main>;
  }
  const [initialInvitations, initialSettings] = await Promise.all([allInvitations(), settings()]);
  return <Dashboard initialInvitations={initialInvitations} initialSettings={initialSettings} role={identity.role} />;
}
