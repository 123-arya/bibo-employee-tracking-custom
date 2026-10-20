import { useEffect, useRef, useState } from "react";
import { call as invoke } from "../api";
import { useTranslation } from "react-i18next";
import keycloak from "../auth/keycloak";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";

export type Session = {
  email: string;
  business_id?: string | null;
};

type LoginProps = {
  onLoggedIn: (session: Session) => void;
};

let keycloakInitPromise: Promise<boolean> | null = null;
function initKeycloak(): Promise<boolean> {
  if (!keycloakInitPromise) {
    keycloakInitPromise = keycloak.init({
      onLoad: "check-sso",
      checkLoginIframe: false,
      pkceMethod: "S256",
    });
  }
  return keycloakInitPromise;
}

/** Accept only the link created by the ERPNext reset-page button. */
function resetKeyFromDeepLink(rawUrl: string): string | null {
  try {
    const incoming = new URL(rawUrl);
    if (incoming.protocol !== "bibo:" || incoming.hostname !== "password-reset") {
      return null;
    }

    // ERPNext sends: bibo://password-reset?target=<encoded reset URL>
    const target = incoming.searchParams.get("target");
    if (!target) return null;

    const targetUrl = new URL(target);
    if (
      targetUrl.protocol !== "https:" ||
      targetUrl.hostname !== "erp.hawkaerosystem.com" ||
      targetUrl.port !== "" ||
      targetUrl.pathname !== "/update-password"
    ) {
      return null;
    }

    const key = targetUrl.searchParams.get("key");
    return key && key.trim() ? key : null;
  } catch {
    return null;
  }
}

export function Login({ onLoggedIn }: LoginProps) {
  const { t } = useTranslation("auth");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let mounted = true;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let resetRequested = false;
    const processedUrls = new Set<string>();

    async function processResetUrl(rawUrl: string): Promise<boolean> {
      if (disposed || processedUrls.has(rawUrl)) return false;

      const key = resetKeyFromDeepLink(rawUrl);
      if (!key) return false;

      processedUrls.add(rawUrl);
      resetRequested = true;
      setError(null);
      setLoading(true);

      try {
        console.log("Opening ERPNext password-reset page inside Bibo.");
        await invoke("open_erpnext_password_reset", { key });
        if (!disposed) setLoading(false);
      } catch (err) {
        processedUrls.delete(rawUrl);
        console.error("Failed to open ERPNext password-reset page:", err);
        if (!disposed) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
      return true;
    }

    async function setupDeepLinks(): Promise<boolean> {
      let initialResetLinkFound = false;
      try {
        // Subscribe first, so links arriving while startup is in progress aren't missed.
        unlisten = await onOpenUrl(async (urls) => {
          for (const url of urls) {
            await processResetUrl(url);
          }
        });

        // If the link launched Bibo from closed state, process it before Keycloak login.
        const currentUrls = await getCurrent();
        if (currentUrls && !disposed) {
          for (const url of currentUrls) {
            const handled = await processResetUrl(url);
            initialResetLinkFound = handled || initialResetLinkFound;
          }
        }
      } catch (err) {
        console.error("Deep-link initialization failed:", err);
      }
      return initialResetLinkFound;
    }

    async function startLogin() {
      try {
        console.log("Initializing Keycloak login.");
        const authenticated = await initKeycloak();
        // A reset link takes priority over the normal ERPNext home-page redirect.
        if (disposed || resetRequested) return;
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

        const session: Session = { email, business_id: null };
        console.log("Authenticated employee:", email);
        onLoggedIn(session);

        // Do not redirect to the normal home page when a reset link is being handled.
        if (!resetRequested) await invoke("open_erpnext");
        if (!disposed) setLoading(false);
      } catch (err) {
        console.error("Keycloak login failed:", err);
        if (!disposed && !resetRequested) {
          setError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
          setLoading(false);
        }
      }
    }

    void (async () => {
      const resetLinkFound = await setupDeepLinks();
      if (disposed) return;
      if (resetLinkFound || resetRequested) {
        // The Rust command has navigated this window to ERPNext's reset page.
        setLoading(false);
        return;
      }
      await startLogin();
    })();

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
          <button type="button" onClick={() => window.location.reload()}>
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
