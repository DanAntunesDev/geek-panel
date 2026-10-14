import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { DeviceApp } from "./device/DeviceApp.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("elemento root não encontrado");
}

createRoot(container).render(
  <React.StrictMode>
    {location.hash === "#device" ? <DeviceApp /> : <App />}
  </React.StrictMode>,
);
