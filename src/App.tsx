import { useEffect, useRef, useState } from "react";
import "./App.css";
import { TimeController } from "./core/TimeController";
import { SceneManager } from "./renderer/SceneManager";
import { experiences, getExperience } from "./experiences/index";
import { useTimeState } from "./ui/useTimeState";

const controller = new TimeController();

function App() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const state = useTimeState(controller);

  const experience = getExperience("mock")!;

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const manager = new SceneManager(container, controller);
    sceneManagerRef.current = manager;
    manager.setHoverListener(setHoveredId);
    manager.mount(experience);
    manager.start();

    return () => {
      manager.dispose();
      sceneManagerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentEvent = experience.getCurrentEvent(state.time);
  const hovered = hoveredId ? experience.getHoveredObject(hoveredId) : null;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title">4sight</div>
        <nav className="app__nav">
          {experiences.map((e) => (
            <button
              key={e.id}
              className={
                e.id === experience.id ? "app__nav-item app__nav-item--active" : "app__nav-item"
              }
              disabled
            >
              {e.name}
            </button>
          ))}
        </nav>
      </header>

      <main className="app__main">
        <div className="app__viewport" ref={viewportRef}>
          {hovered && (
            <div className="tooltip">
              <strong>{hovered.name}</strong>
              {hovered.description && <div>{hovered.description}</div>}
            </div>
          )}
        </div>

        <aside className="app__panel glass">
          <h2>What's happening?</h2>
          {currentEvent ? (
            <>
              <h3>{currentEvent.title}</h3>
              <div className="app__panel-when">{currentEvent.when}</div>
              {currentEvent.description && <p>{currentEvent.description}</p>}
              {currentEvent.keyPoints.length > 0 && (
                <ul>
                  {currentEvent.keyPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p>Drag the slider to begin.</p>
          )}
        </aside>
      </main>

      <footer className="app__transport glass">
        <button onClick={() => controller.toggle()}>{state.isPlaying ? "Pause" : "Play"}</button>
        <button onClick={() => controller.reverse()}>Reverse ({state.direction === 1 ? "→" : "←"})</button>
        <button onClick={() => controller.reset()}>Reset</button>

        <span className="app__label">{experience.labels.start}</span>
        <input
          id="time-slider"
          name="time-slider"
          className="app__slider"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={state.param}
          onChange={(e) => controller.setParam(Number(e.target.value))}
        />
        <span className="app__label">{experience.labels.end}</span>

        <span className="app__time">{experience.mapping.format(state.time)}</span>

        <select
          id="playback-speed"
          name="playback-speed"
          value={state.playbackSpeed}
          onChange={(e) => controller.setPlaybackSpeed(Number(e.target.value))}
        >
          {experience.warpPresets.map((warp) => (
            <option key={warp} value={warp}>
              {warp}x
            </option>
          ))}
        </select>
      </footer>
    </div>
  );
}

export default App;
