import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Confirm from "./components/Confirm";
import OAuthCallback from "./components/OAuthCallback";

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (window.location.pathname === '/confirm') {
  root.render(
    <React.StrictMode>
      <Confirm />
    </React.StrictMode>
  );
} else if (window.location.pathname === '/auth/oauth-callback') {
  root.render(
    <React.StrictMode>
      <OAuthCallback />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
