"use client";

import { useEffect } from "react";
import { useRouter } from "@/store/router";
import { AppHeader, AppFooter } from "@/components/app/shell";
import { ScreenRouter } from "@/components/app/screen-router";

export default function Home() {
  const init = useRouter((s) => s.init);

  useEffect(() => {
    return init();
  }, [init]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1">
        <ScreenRouter />
      </main>
      <AppFooter />
    </div>
  );
}
