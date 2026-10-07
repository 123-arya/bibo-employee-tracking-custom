//import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
//import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { call as invoke } from "../api";
import { useTranslation } from "react-i18next";
import keycloak from "../auth/keycloak";

export type Session = {
  email: string;
  business_id?: string | null;
};

type LoginProps = {
  onLoggedIn: (session: Session) => void;
};

/*
 * Keep ONE Keycloak initialization promise.
 * This prevents React StrictMode from initializing
 * the same Keycloak instance twice.
 */
let keycloakInitPromise: Promise<boolean> | null = null;

function initKeycloak() {
  if (!keycloakInitPromise) {
    console.log("Starting Keycloak initialization...");

    keycloakInitPromise = keycloak.init({
      onLoad: "check-sso",
      checkLoginIframe: false,
      pkceMethod: "S256",

    });
  }

  return keycloakInitPromise;
}

export function Login({ onLoggedIn }: LoginProps) {
  const { t } = useTranslation("auth");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function startLogin() {
      try {
        console.log("Calling Keycloak init...");

        const authenticated = await initKeycloak();

        console.log("Keycloak authenticated:", authenticated);

        if (!mounted) {
          return;
        }

        if (!authenticated) {
          console.log("No active Keycloak session. Opening login...");

          await keycloak.login({
            prompt: "login",
          });

          return;
        }
        console.log("Existing Keycloak session found.");
        const email =
          keycloak.tokenParsed?.email ||
          keycloak.tokenParsed?.preferred_username ||
          "";

        console.log("Keycloak user:", email);

        if (!email) {
          setError(
              "Keycloak login succeeded, but no employee email/username was returned."
          );
          setLoading(false);
          return;
        }

        const session: Session = {
          email,
          business_id: null,
        };

        onLoggedIn(session);
	
//	console.log("Employee authenticated:", email);
//	console.log("Keycloak login completed.");
//        await openUrl("http://erpnext.localhost:8000");
//	console.log("ERPNext opened in browser.");
        console.log("Employee authenticated:", email);
	console.log("Opening ERPNext inside Bibo...");

	try {
          await invoke("open_erpnext");
          console.log("ERPNext embedded inside Bibo.");
        } catch (err) {
          console.error("Failed to open ERPNext inside Bibo:", err);
        }
        if (mounted) {
          setLoading(false);
        }
      } catch (err) {
         console.error("Keycloak login error:", err);

        if (mounted) {
          setError(
            err instanceof Error
              ? `${err.name}: ${err.message}`
              : String(err)
          );

          setLoading(false);
        }
      }
    }

    startLogin();

    return () => {
      mounted = false;
    };
  }, [onLoggedIn]);

  if (loading) {
    return (
      <div className="login welcome">
        <div className="login-card">
          <h1 className="login-title">BiBoTracking</h1>

          <p className="login-sub">{t("login.subtitle")}</p>

          <div className="auth-form">
            <p className="muted">
              Opening Keycloak login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="login welcome">
        <div className="login-card">
          <h1 className="login-title">
            Keycloak Login Failed
          </h1>

          <div className="auth-form">
            <div className="auth-err" role="alert">
              {error}
            </div>

            <button
              className="auth-btn"
              type="button"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
