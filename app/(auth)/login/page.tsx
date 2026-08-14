import { Suspense } from "react";
import LoginClient from "./login-client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-sm text-inkMuted">Memuat halaman masuk…</div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
