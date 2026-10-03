// src/App.tsx
//
// Composition only. The renderer is created once; switching experiences
// goes through showExperience. The first experience opens on the moment in
// the URL (?x=<id>&u=<u>), paused.

import { useEffect, useRef } from "react";
import { parseMoment } from "./core/moment";
import { experiences } from "./experiences/index";
import { SceneManager } from "./renderer/SceneManager";
import type { FreeBand } from "./renderer/stageFit";
import { Actions } from "./ui/Actions";
import { ExportDialog } from "./ui/ExportDialog";
import { ExperiencePicker, Gallery } from "./ui/Gallery";
import { InfoPanel } from "./ui/InfoPanel";
import { ObjectInfo } from "./ui/ObjectInfo";
import { PerspectiveControls } from "./ui/PerspectiveControls";
import { StageNotice, StatusRail } from "./ui/StatusRail";
import { TimeControls, TimeReadout } from "./ui/TimeControls";
import { TimeWarp } from "./ui/TimeWarp";
import { Timeline } from "./ui/Timeline";
import { Mark } from "./ui/icons";
import { controller, currentMoment, getUi, runtime, setUi, showExperience, useUi } from "./ui/runtime";
import { startUrlSync } from "./ui/urlSync";
import { useShortcuts } from "./ui/useShortcuts";

function App() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const transportRef = useRef<HTMLElement | null>(null);
  const topbarRef = useRef<HTMLElement | null>(null);
  const experience = useUi((s) => s.experience);
  useShortcuts();

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;
    const manager = new SceneManager(container, controller);
    runtime.manager = manager;
    manager.setHoverListener((hoveredId) => setUi({ hoveredId }));
    manager.setCameraListener((camera) => setUi({ camera }));
    manager.start();
    const urlSync = startUrlSync(controller, currentMoment, () => {
      const { tour, exporting } = getUi();
      return tour.phase === "travelling" || exporting.phase === "rendering";
    });
    runtime.urlSync = urlSync;
    const moment = parseMoment(
      window.location.search,
      experiences.map((e) => e.id),
      experiences[0].id,
    );
    void showExperience(moment.id, moment.u);
    return () => {
      urlSync.dispose();
      runtime.urlSync = null;
      manager.dispose();
      runtime.manager = null;
    };
  }, []);

  useEffect(() => {
    if (experience) runtime.urlSync?.flush();
  }, [experience]);

  // The mobile bottom sheet sits just above the transport bar, whatever its
  // height, and camera presets frame their subject in the band the HUD leaves free.
  useEffect(() => {
    const stage = viewportRef.current;
    const topbar = topbarRef.current;
    const transport = transportRef.current;
    if (!stage || !topbar || !transport) return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--transport-h", `${transport.offsetHeight}px`);
      runtime.manager?.setFreeBand(freeBand(stage, topbar, transport));
    });
    for (const el of [stage, topbar, transport]) ro.observe(el);
    return () => ro.disconnect();
  }, [experience]);

  return (
    <div className="app">
      <div className="stage" ref={viewportRef} />
      <div className="vignette" aria-hidden="true" />

      <header className="topbar" ref={topbarRef}>
        <div className="topbar__start">
          <div className="brand sticker">
            <Mark />
            <span className="brand__word">4sight</span>
          </div>
          <Actions />
        </div>
        <ExperiencePicker />
        <PerspectiveControls />
        <StatusRail />
      </header>

      <StageNotice />

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

      <Gallery />
      <ExportDialog />
    </div>
  );
}

/**
 * The stage between the top bar and the bottom chrome. Status chips come and
 * go, so they do not count. A bottom sheet counts at its collapsed height,
 * so opening it to read does not move the camera.
 */
function freeBand(stage: HTMLElement, topbar: HTMLElement, transport: HTMLElement): FreeBand {
  const box = stage.getBoundingClientRect();
  const bars = topbar.querySelectorAll(":scope > :not(.rail), :scope > .topbar__start > *");
  const top = Math.max(box.top, ...Array.from(bars, (el) => el.getBoundingClientRect().bottom));
  let bottom = transport.getBoundingClientRect().top;
  const sheet = document.querySelector<HTMLElement>(".info");
  const head = sheet?.querySelector<HTMLElement>(".info__head");
  if (sheet && head) {
    const r = sheet.getBoundingClientRect();
    const middle = box.left + box.width / 2;
    if (r.left < middle && r.right > middle) {
      bottom = Math.min(bottom, r.bottom - head.offsetHeight - (sheet.offsetHeight - sheet.clientHeight));
    }
  }
  return { top: (top - box.top) / box.height, bottom: (bottom - box.top) / box.height };
}

export default App;
