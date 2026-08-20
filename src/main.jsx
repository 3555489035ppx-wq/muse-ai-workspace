import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.jsx";
import "./styles.css";
import "./industrial.css";
import "./portfolio/capture-mode.css";

createRoot(document.getElementById("root")).render(
  <BrowserRouter><App /></BrowserRouter>,
);
