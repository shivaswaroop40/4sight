// src/App.tsx
//
// Composition only. The renderer is created once; switching experiences
// goes through SceneManager.mount, which disposes the old experience,
// mounts the new one, resets u to 0 (paused), and frames its first preset.

import { useCallback, useEffect, useRef } from "react";
import type { ExperienceId } from "./core/types";
import { experiences, getExperience } from "./experiences/index";
import { SceneManager } from "./renderer/SceneManager";
import { ExperienceNav } from "./ui/ExperienceNav";
import { InfoPanel } from "./ui/InfoPanel";
import { ObjectInfo } from "./ui/ObjectInfo";
import { PerspectiveControls } from "./ui/PerspectiveControls";
import { TimeControls, TimeReadout } from "./ui/TimeControls";
import { TimeWarp } from "./ui/TimeWarp";
import { Timeline } from "./ui/Timeline";
import { Mark } from "./ui/icons";
import { controller, runtime, setUi, useUi } from "./ui/runtime";
import { useShortcuts } from "./ui/useShortcuts";

function idFromUrl(): ExperienceId {
  const wanted = new URLSearchParams(window.location.search).get("x");
  const match = experiences.find((e) => e.id === wanted);
  return (match ?? experiences[0]).id;
}

function writeUrl(id: ExperienceId): void {
  const url = new URL(window.location.href);
  url.searchParams.set("x", id);
  window.history.replaceState(null, "", url);
}

setUi({ experienceId: idFromUrl() });

function App() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const transportRef = useRef<HTMLElement | null>(null);
  const experienceId = useUi((s) => s.experienceId);
  const experience = experienceId ? getExperience(experienceId) : undefined;
  useShortcuts();

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;
    const manager = new SceneManager(container, controller);
    runtime.manager = manager;
    manager.setHoverListener((hoveredId) => setUi({ hoveredId }));
    const initial = getExperience(idFromUrl())!;
    manager.mount(initial);
    setUi({ experienceId: initial.id });
    writeUrl(initial.id);
    manager.start();
    return () => {
      manager.dispose();
      runtime.manager = null;
    };
  }, []);

  // The mobile bottom sheet sits just above the transport bar, whatever its height.
  useEffect(() => {
    const el = transportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      document.documentElement.style.setProperty("--transport-h", `${el.offsetHeight}px`),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [experience]);

  const switchTo = useCallback((id: ExperienceId) => {
    const next = getExperience(id);
    const manager = runtime.manager;
    if (!next || !manager || manager.current === next) return;
    manager.mount(next, true);
    setUi({ experienceId: id, hoveredId: null });
    writeUrl(id);
  }, []);

  return (
    <div className="app">
      <div className="stage" ref={viewportRef} />
      <div className="vignette" aria-hidden="true" />

      <header className="topbar">
        <div className="brand sticker">
          <Mark />
          <span className="brand__word">4sight</span>
        </div>
        <ExperienceNav experiences={experiences} onSelect={switchTo} />
        <PerspectiveControls />
      </header>

      {experience && (
        <>
          <InfoPanel key={experience.id} experience={experience} />
          <ObjectInfo experience={experience} />
          <footer className="card transport" ref={transportRef}>
            <div className="transport__row">
              <TimeControls />
              <TimeReadout experience={experience} />
              <TimeWarp experience={experience} />
            </div>
            <Timeline experience={experience} />
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
