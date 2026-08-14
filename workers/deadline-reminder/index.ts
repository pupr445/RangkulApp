export interface Env {
  RANGKUL_APP_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(_controller: unknown, env: Env) {
    const response = await fetch(`${env.RANGKUL_APP_URL.replace(/\/$/, "")}/api/cron/deadline-reminders`, {
      method: "GET",
      headers: {
        "x-cron-secret": env.CRON_SECRET,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Deadline reminder gagal: HTTP ${response.status} ${body}`);
    }
  },
};
