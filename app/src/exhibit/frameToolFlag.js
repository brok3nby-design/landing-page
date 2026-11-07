// ?frames turns on the frame tool for this visit (see FrameTool.jsx); kept separate so checking it is free
const ON = "b3d-frame-tool";
export function frameToolOn() {
  try {
    if (new URLSearchParams(location.search).has("frames")) sessionStorage.setItem(ON, "1");
    return sessionStorage.getItem(ON) === "1";
  } catch { return false; }
}
