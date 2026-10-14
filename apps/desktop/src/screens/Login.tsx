import { useEffect, useRef, useState } from "react";
import { call as invoke } from "../api";
import { useTranslation } from "react-i18next";
import keycloak from "../auth/keycloak";
import {
  getCurrent,
  onOpenUrl,
} from "@tauri-apps/plugin-deep-link";

export type Session = {
  email: string;
  business_id?: string | null;
};

type LoginProps = {
  onLoggedIn: (session: Session) => void;
};

/*
 * Initialize Keycloak only once.
 */
let keycloakInitPromise: Promise<boolean> | null = null;

function initKeycloak(): Promise<boolean> {
  if (!keycloakInitPromise) {
    keycloakInitPromise = keycloak.init({
      onLoad: "login-required",
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

  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    // Prevent the same reset URL from being processed repeatedly.
    const processedUrls = new Set<string>();

    async function processResetUrl(rawUrl: string) {
      if (disposed || processedUrls.has(rawUrl)) {
        return;
      }

      try {
        const url = new URL(rawUrl);

        // Expected format:
        // bibo://reset-password?key=RESET_TOKEN
        if (
          url.protocol !== "bibo:" ||
          url.hostname !== "reset-password"
        ) {
          return;
        }

        const key = url.searchParams.get("key");

        if (!key || !key.trim()) {
          console.error("Password-reset URL is missing its key.");
          return;
        }

        processedUrls.add(rawUrl);

        console.log("Opening ERPNext password-reset page inside Bibo.");

        await invoke("open_erpnext_password_reset", { key });
      } catch (err) {
        processedUrls.delete(rawUrl);

        console.error(
          "Failed to process password-reset deep link:",
          err
        );
      }
    }

    async function setupDeepLinks() {
      try {
        // Handle links received while Bibo is already running.
        unlisten = await onOpenUrl(async (urls) => {
          for (const url of urls) {
            await processResetUrl(url);
          }
        });

        // Handle a link that launched Bibo from a closed state.
        const currentUrls = await getCurrent();

        if (currentUrls && !disposed) {
          for (const url of currentUrls) {
            await processResetUrl(url);
          }
        }
      } catch (err) {
        console.error("Deep-link initialization failed:", err);
      }
    }

    async function startLogin() {
      try {
        console.log("Initializing Keycloak login.");

        const authenticated = await initKeycloak();

        if (disposed) {
          return;
        }

        if (!authenticated) {
          throw new Error("Keycloak authentication did not complete.");
        }

        const email =
          keycloak.tokenParsed?.email ||
          keycloak.tokenParsed?.preferred_username ||
          "";

        if (!email) {
          setError(
            "Keycloak login succeeded, but no employee email or username was returned."
          );
          setLoading(false);
          return;
        }

        const session: Session = {
          email,
          business_id: null,
        };

        console.log("Authenticated employee:", email);

        onLoggedIn(session);

        /*
         * Open ERPNext for normal login.
         * The reset-link handler separately opens the reset page.
         */
        await invoke("open_erpnext");

        if (!disposed) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Keycloak login failed:", err);

        if (!disposed) {
          setError(
            err instanceof Error
              ? `${err.name}: ${err.message}`
              : String(err)
          );

          setLoading(false);
        }
      }
    }

    void setupDeepLinks();
    void startLogin();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onLoggedIn]);

  if (loading) {
    return (
      <div className="login welcome">
        <div className="login-card">
          <h1 className="login-title">BiBoTracking</h1>
          <p>{t("loggingIn", "Connecting to your account...")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="login welcome">
        <div className="login-card">
          <h1 className="login-title">BiBoTracking</h1>
          <p role="alert">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login welcome">
      <div className="login-card">
        <h1 className="login-title">BiBoTracking</h1>
        <p>{t("loginSuccess", "Connected successfully.")}</p>
      </div>
    </div>
  );
}
