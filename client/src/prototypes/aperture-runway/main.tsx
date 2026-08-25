import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../index.css";
import "./aperture-runway-prototype.css";
import { ApertureRunwayPrototype } from "./ApertureRunwayPrototype";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApertureRunwayPrototype />
  </StrictMode>,
);
