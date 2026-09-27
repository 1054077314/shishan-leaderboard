import React, { useEffect, useState } from "react";
import { AppViewSwitcher, type AppView } from "./components/AppViewSwitcher";
import KillLineView from "./views/KillLineView";
import EvaluationView from "./views/EvaluationView";

function viewFromHash(): AppView {
  return window.location.hash.replace(/^#\/?/, "").startsWith("evaluation")
    ? "evaluation"
    : "kill-line";
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(viewFromHash);

  useEffect(() => {
    const handleHashChange = () => setActiveView(viewFromHash());
    window.addEventListener("hashchange", handleHashChange);
    if (!window.location.hash) window.history.replaceState(null, "", "#/kill-line");
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const changeView = (view: AppView) => {
    const nextHash = view === "evaluation" ? "#/evaluation" : "#/kill-line";
    if (window.location.hash === nextHash) {
      setActiveView(view);
    } else {
      window.location.hash = nextHash;
    }
  };

  return (
    <>
      <AppViewSwitcher activeView={activeView} onChange={changeView} />
      {activeView === "kill-line" ? <KillLineView /> : <EvaluationView />}
    </>
  );
}
